const express = require('express');
const multer = require('multer');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const ejs = require('ejs');
const methodOverride = require('method-override');

const app = express();
const port = 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

const transporter = nodemailer.createTransport(config.nodemailer);

const sendEmail = (to, subject, html, attachmentPath) => {
  const mailOptions = {
    from: 'gpoquendo4@gmail.com',
    to,
    subject,
    html,
    attachments: [
      {
        path: attachmentPath
      }
    ]
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error('Error sending email:', error);
    } else {
      console.log('Email sent:', info.response);
    }
  });
};

const mysql = require('mysql2');
const connection = mysql.createConnection(config.mysql);

connection.connect(err => {
  if (err) {
    console.error('Error connecting to MySQL:', err);
  } else {
    console.log('Connected to MySQL database');
  }
});

app.get('/', (req, res) => {
  connection.query('SELECT * FROM events', (err, results) => {
    if (err) {
      console.error('Error fetching events:', err);
      res.status(500).send('Internal Server Error');
      return;
    }

    res.render('index', { events: results });
  });
});

app.get('/events/new', (req, res) => {
  res.render('new');
});

app.post('/events', upload.single('eventImage'), (req, res) => {
  const { name, date, time, location, description } = req.body;
  const eventImage = req.file ? req.file.filename : null;
  const imagePath = path.join(__dirname, 'uploads', eventImage);

  connection.query(
    'INSERT INTO events (name, date, time, location, description) VALUES (?, ?, ?, ?, ?)',
    [name, date, time, location, description],
    (err, results) => {
      if (err) {
        console.error('Error creating event:', err);
        res.status(500).send('Internal Server Error');
        return;
      }

      const eventId = results.insertId;

      connection.query(
        'INSERT INTO event_images (event_id, image) VALUES (?, ?)',
        [eventId, eventImage],
        (err) => {
          if (err) {
            console.error('Error inserting image details:', err);
            res.status(500).send('Internal Server Error');
            return;
          }

          const eventName = req.body.name;
          const creatorEmail = 'gpoquendo4@gmail.com';

          const subject = `Event Created: ${eventName}`;
          const html = `Congratulations! You have successfully created the event "${eventName}".<br><br>
            Date: ${req.body.date}<br>
            Time: ${req.body.location}<br>
            Description: ${req.body.description}`;

          sendEmail(creatorEmail, subject, html, imagePath);

          const additionalAttendees = req.body.additionalAttendees;
          const attendeesArray = additionalAttendees.split(',').map(item => item.trim());

          if (attendeesArray && Array.isArray(attendeesArray)) {
            attendeesArray.forEach((attendeeEmail) => {
              const subjectAttendee = `Event Invitation: ${eventName}`;
              const htmlAttendee = `You have been invited to the event "${eventName}".<br><br>
              Date: ${req.body.date}<br>
              Time: ${req.body.location}<br>
              Description: ${req.body.description}<br>`;

              sendEmail(attendeeEmail, subjectAttendee, htmlAttendee, imagePath);
            });
          }

          res.redirect('/');
        }
      );
    });
});

app.get('/events/:id', (req, res) => {
  const eventId = req.params.id;

  connection.query('SELECT * FROM events WHERE id = ?', [eventId], (err, results) => {
    if (err) {
      console.error('Error fetching event details:', err);
      res.status(500).send('Internal Server Error');
      return;
    }

    const event = results[0];
    if (!event) {
      res.status(404).send('Event not found');
      return;
    }

    connection.query('SELECT image FROM event_images WHERE event_id = ?', [eventId], (err, imageResults) => {
      if (err) {
        console.error('Error fetching image details:', err);
        res.status(500).send('Internal Server Error');
        return;
      }

      const image = imageResults.length > 0 ? imageResults[0].image : null;

      res.render('show', { event, image });
    });
  });
});

app.post('/events/:id/send-email', async (req, res) => {
  const eventId = req.params.id;

  connection.query('SELECT * FROM events WHERE id = ?', [eventId], (err, results) => {
    if (err) throw err;

    const event = results[0];
    if (!event) {
      res.status(404).send('Event not found');
      return;
    }

    const eventName = event.name;
    const eventDate = event.date;
    const eventTime = event.time;
    const eventLocation = event.location;
    const eventDescription = event.description;
    const additionalAttendees = req.body.additionalAttendees;

    if (additionalAttendees) {
      const attendeesArray = additionalAttendees.split(',').map(item => item.trim());

      for (let attendeeEmail of attendeesArray) {
        const subjectAttendee = `Event Invitation: ${eventName}`;
        const htmlAttendee = `You have been invited to the event "${eventName}".<br><br>
          Date: ${eventDate}<br>
          Time: ${eventTime}<br>
          Location: ${eventLocation}<br>
          Description: ${eventDescription}`;

        try {
          sendEmail(attendeeEmail, subjectAttendee, htmlAttendee);
        } catch (error) {
          console.error(`Failed to send email to ${attendeeEmail}: ${error}`);
        }
      }

      console.log("emails sent!");
    }

    res.redirect(`/events/${eventId}`);
  });
});

app.get('/events/:id/edit', (req, res) => {
  const eventId = req.params.id;

  connection.query('SELECT * FROM events WHERE id = ?', [eventId], (err, results) => {
    if (err) {
      console.error('Error fetching event details:', err);
      res.status(500).send('Internal Server Error');
      return;
    }

    const event = results[0];
    if (!event) {
      res.status(404).send('Event not found');
      return;
    }

    connection.query('SELECT image FROM event_images WHERE event_id = ?', [eventId], (err, imageResults) => {
      if (err) {
        console.error('Error fetching image details:', err);
        res.status(500).send('Internal Server Error');
        return;
      }

      const image = imageResults.length > 0 ? imageResults[0].image : null;
      res.render('edit', { event, image });
    });
  });
});

app.put('/events/:id', upload.single('eventImage'), (req, res) => {
  const eventId = req.params.id;
  const { name, date, time, location, description } = req.body;
  const eventImage = req.file ? req.file.filename : null;

  connection.query(
    'UPDATE events SET name = ?, date = ?, time = ?, location = ?, description = ? WHERE id = ?',
    [name, date, time, location, description, eventId],
    (err, results) => {
      if (err) {
        console.error('Error updating event:', err);
        res.status(500).send('Internal Server Error');
        return;
      }

      connection.query(
        'UPDATE event_images SET image = ? WHERE event_id = ?',
        [eventImage, eventId],
        (err) => {
          if (err) {
            console.error('Error updating image details:', err);
            res.status(500).send('Internal Server Error');
            return;
          }

          res.redirect('/');
        }
      );
    }
  );
});

app.delete('/events/:id', (req, res) => {
  const eventId = req.params.id;

  connection.query('SELECT image FROM event_images WHERE event_id = ?', [eventId], (err, results) => {
    if (err) {
      console.error('Error fetching image details:', err);
      res.status(500).send('Internal Server Error');
      return;
    }

    const image = results.length > 0 ? results[0].image : null;

    connection.query('DELETE FROM events WHERE id = ?', [eventId], (err) => {
      if (err) {
        console.error('Error deleting event:', err);
        res.status(500).send('Internal Server Error');
        return;
      }

      connection.query('DELETE FROM event_images WHERE event_id = ?', [eventId], (err) => {
        if (err) {
          console.error('Error deleting image details:', err);
          res.status(500).send('Internal Server Error');
          return;
        }

        if (image) {
          const imagePath = path.join(__dirname, 'uploads', image);

          fs.unlink(imagePath, (err) => {
            if (err) {
              console.error('Error deleting image file:', err);
              res.status(500).send('Internal Server Error');
              return;
            }

            res.redirect('/');
          });
        } else {
          res.redirect('/');
        }
      });
    });
  });
});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});