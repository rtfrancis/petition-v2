var spicedPg = require("spiced-pg");
const bcrypt = require("bcryptjs");

var db = spicedPg(
    process.env.DATABASE_URL ||
        "postgres:postgres:postgres@localhost:5432/petition"
);

module.exports.signPetition = function signPetition(user_id, sig) {
    return db.query(
        `
        INSERT INTO signatures (user_id, signature)
        VALUES ($1, $2) RETURNING id, signature
        `,
        [user_id || null, sig || null]
    );
};

module.exports.getSigners = function getSigners() {
    return db.query(`SELECT users.first, users.last, age, city, url
                    FROM signatures
                    LEFT JOIN users
                    ON signatures.user_id = users.id
                    LEFT JOIN user_profiles
                    ON users.id = user_profiles.user_id

                    `);
};

module.exports.getCount = function getCount() {
    return db.query(`SELECT COUNT(*) FROM signatures`);
};

module.exports.sigFind = function sigFind(userId) {
    return db.query(`SELECT id, signature FROM signatures WHERE user_id = $1`, [
        userId
    ]);
};

module.exports.register = function register(first, last, email, password) {
    return db.query(
        `INSERT INTO users (first, last, email, password) VALUES ($1, $2, $3, $4) RETURNING id, first, last`,
        [first || null, last || null, email || null, password || null]
    );
};

module.exports.savePass = function savePass(hashedPass) {
    return db.query(`INSERT INTO users password VALUES $1`, [hashedPass]);
};

module.exports.sigFindNew = function sigFindNew(sigId) {
    return db.query(`SELECT * FROM signatures WHERE user_id = $1`, [sigId]);
};

module.exports.getUserByEmail = function getUserByEmail(email) {
    return db.query(
        `
        SELECT users.id as user_id, signatures.id as sig_id, signatures.user_id as sig_user, users.first, users.last, password
        FROM users
        LEFT JOIN signatures
        ON signatures.user_id = users.id
        WHERE email = $1`,
        [email]
    );
};

module.exports.userProfile = function userProfile(age, city, url, user_id) {
    return db.query(
        `INSERT INTO user_profiles (age, city, url, user_id) VALUES ($1, $2, $3, $4) RETURNING id`,
        [age ? Number(age) : null, city, url, user_id || null]
    );
};

module.exports.signersByCity = function signersByCity(city) {
    return db.query(
        `SELECT users.first, users.last, age, city, url
        FROM signatures
        LEFT JOIN users
        ON signatures.user_id = users.id
        JOIN user_profiles
        ON users.id = user_profiles.user_id
        WHERE LOWER(city) = LOWER($1)
        `,
        [city]
    );
};
module.exports.editUserTable = function editUserTable(
    first,
    last,
    email,
    id,
    password
) {
    return db.query(
        `UPDATE users
        SET first = $1, last = $2, email = $3, password = $5
        WHERE id = $4
        RETURNING first, last
        `,
        [first, last, email, id || null, password]
    );
};

module.exports.editUserNoPass = function editUserNoPass(
    first,
    last,
    email,
    id
) {
    return db.query(
        `UPDATE users
        SET first = $1, last = $2, email = $3
        WHERE id = $4
        RETURNING first, last
        `,
        [first, last, email, id || null]
    );
};

module.exports.editProfileTable = function editProfileTable(
    age,
    city,
    url,
    user_id
) {
    return db.query(
        `INSERT INTO user_profiles (age, city, url, user_id)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (user_id)
    DO UPDATE SET age = $1, city = $2, url = $3
    `,
        [age ? Number(age) : null, city, url, user_id]
    );
};

module.exports.returnProfile = function returnProfile(userId) {
    return db.query(
        `SELECT first, last, email, age, city, url
        FROM users
        LEFT JOIN user_profiles
        ON users.id = user_profiles.user_id
        WHERE users.id = $1
        `,
        [userId]
    );
};

module.exports.deleteSig = function deleteSig(userId) {
    return db.query(
        `DELETE FROM signatures
        WHERE user_id = $1`,
        [userId]
    );
};

// //////////////////// PASSWORD HASHING /////////////////////////////

module.exports.hashPassword = function hashPassword(plainTextPassword) {
    return new Promise(function(resolve, reject) {
        bcrypt.genSalt(function(err, salt) {
            if (err) {
                return reject(err);
            }
            // console.log(salt);
            bcrypt.hash(plainTextPassword, salt, function(err, hash) {
                if (err) {
                    return reject(err);
                }

                resolve(hash);
            });
        });
    });
};

module.exports.checkPassword = function checkPassword(
    textEnteredInLoginForm,
    hashedPasswordFromDatabase
) {
    return new Promise(function(resolve, reject) {
        bcrypt.compare(
            textEnteredInLoginForm,
            hashedPasswordFromDatabase,
            function(err, doesMatch) {
                if (err) {
                    reject(err);
                } else {
                    resolve(doesMatch);
                }
            }
        );
    });
};
