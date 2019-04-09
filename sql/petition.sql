DROP TABLE IF EXISTS signatures;

CREATE TABLE signatures(
    id SERIAL PRIMARY KEY,
    user_id INTEGER references users(id) NOT NULL,
    signature TEXT NOT NULL
);
