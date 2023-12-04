CREATE DATABASE event_portal_db;

USE event_portal_db;

CREATE TABLE events (
    id INT AUTO_INCREMENT,
    name VARCHAR(100),
    date DATE,
    time TIME,
    location VARCHAR(255),
    description TEXT,
    PRIMARY KEY(id)
);

CREATE TABLE event_images (
    id INT AUTO_INCREMENT,
    event_id INT,
    image VARCHAR(255),
    PRIMARY KEY(id),
    FOREIGN KEY (event_id) REFERENCES events(event_id)
);