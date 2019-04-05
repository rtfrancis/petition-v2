const express = require("express");
const app = express();
const secrets = require("./secrets");
const db = require("./db.js");
const cookieSession = require("cookie-session");
const csurf = require("csurf");
const hb = require("express-handlebars");

app.engine("handlebars", hb());
app.set("view engine", "handlebars");

app.use(
    require("body-parser").urlencoded({
        extended: false
    })
);

app.use(require("cookie-parser")());

app.use(express.static(__dirname + "/public"));

app.use(
    cookieSession({
        secret: secrets.COOKIE_SECRET,
        maxAge: 1000 * 60 * 60 * 24 * 14
    })
);
app.use(csurf());

app.use(function(req, res, next) {
    res.setHeader("X-Frame-Options", "DENY");
    res.locals.csrfToken = req.csrfToken();
    next();
});

app.get("/", function(req, res) {
    if (req.session.userId) {
        return res.redirect("/thanks");
    }
    if (!req.session.userId) {
        res.redirect("/petition");
    } else {
        res.redirect("/register");
    }
});

app.get("/register", requireLoggedOut, function(req, res) {
    res.render("registration", {
        layout: "main"
    });
});

app.post("/register", function(req, res) {
    db
        .hashPassword(req.body.password)
        .then(function(hashedPass) {
            return db.register(
                req.body.first,
                req.body.last,
                req.body.email,
                hashedPass
            );
        })
        .then(function(userId) {
            req.session.userId = userId.rows[0].id;
            req.session.first = userId.rows[0].first;
            req.session.last = userId.rows[0].last;
        })
        .then(function() {
            res.redirect("/profile");
        })
        .catch(function(err) {
            console.log(err);
            res.render("registration", {
                layout: "main",
                error: "error"
            });
        });
});

app.get("/profile", function(req, res) {
    res.render("profile", {
        layout: "main"
    });
});

app.post("/profile", function(req, res) {
    return db
        .userProfile(
            req.body.age,
            req.body.city,
            req.body.url,
            req.session.userId
        )
        .then(function(data) {
            res.redirect("/petition");
        })
        .catch(function(err) {
            console.log(err);
        });
});

app.get("/petition", requireUserId, requireNoSignature, (req, res) => {
    res.render("home", {
        layout: "main",
        first: req.session.first,
        last: req.session.last
    });
});

app.post("/petition", function(req, res) {
    db
        .signPetition(req.session.userId, req.body.sig)
        .then(function(result) {
            req.session.sigId = result.rows[0].id;
            res.redirect("/thanks");
        })
        .catch(function(err) {
            console.log(err);
            res.render("home", {
                layout: "main",
                error: "error",
                first: req.session.first
            });
        });
});

app.get("/login", function(req, res) {
    res.render("login", {
        layout: "main"
    });
});

app.post("/login", function(req, res) {
    let userId;
    let first;
    let last;
    let sigId;

    db
        .getUserByEmail(req.body.email)
        .then(function(data) {
            if (data.rows[0].sig_id) {
                sigId = data.rows[0].sig_id;
            }
            first = data.rows[0].first;
            last = data.rows[0].last;
            userId = data.rows[0].user_id;
            return db.checkPassword(req.body.password, data.rows[0].password);
        })
        .then(function(data) {
            if (data == false) {
                throw new Error();
            } else {
                req.session.userId = userId;
                req.session.first = first;
                req.session.last = last;
                req.session.sigId = sigId;
            }
        })
        .then(function() {
            if (!req.session.sigId) {
                res.redirect("/petition");
            } else {
                res.redirect("/thanks");
            }
        })
        .catch(function(err) {
            console.log(err);
            res.render("login", {
                layout: "main",
                error: "error"
            });
        });
});

app.get("/thanks", requireUserId, requireSignature, function(req, res) {
    Promise.all([db.getCount(), db.sigFindNew(req.session.userId)])
        .then(function([countResult, sigResult]) {
            res.render("thanks", {
                layout: "main",
                number: countResult.rows[0].count,
                signature: sigResult.rows[0].signature,
                first: req.session.first
            });
        })
        .catch(function(err) {
            console.log(err);
        });
});

app.post("/thanks", function(req, res) {
    db.deleteSig(req.session.userId).then(function() {
        req.session.sigId = null;
        res.redirect("/petition");
    });
});

app.get("/editprofile", function(req, res) {
    return db
        .returnProfile(req.session.userId)
        .then(function(data) {
            res.render("edit", {
                layout: "main",
                first: data.rows[0].first,
                last: data.rows[0].last,
                email: data.rows[0].email,
                age: data.rows[0].age,
                city: data.rows[0].city,
                url: data.rows[0].url
            });
        })
        .catch(function(err) {
            console.log(err);
        });
});

app.post("/editprofile", requireUserId, function(req, res) {
    if (req.body.password) {
        return db.hashPassword(req.body.password).then(function(hashedPass) {
            Promise.all([
                db.editUserTable(
                    req.body.first,
                    req.body.last,
                    req.body.email,
                    req.session.userId,
                    hashedPass
                ),
                db.editProfileTable(
                    req.body.age,
                    req.body.city,
                    req.body.url,
                    req.session.userId
                )
            ])
                .then(function([data1, data2]) {
                    req.session.first = data1.rows[0].first;
                    req.session.last = data1.rows[0].last;
                    res.redirect("/thanks");
                })
                .catch(function(err) {
                    res.render("edit", {
                        layout: "main",
                        error: "error"
                    });
                    console.log(err);
                });
        });
    } else {
        Promise.all([
            db.editUserNoPass(
                req.body.first,
                req.body.last,
                req.body.email,
                req.session.userId
            ),
            db.editProfileTable(
                req.body.age,
                req.body.city,
                req.body.url,
                req.session.userId
            )
        ])
            .then(function([data1, data2]) {
                req.session.first = data1.rows[0].first;
                req.session.last = data1.rows[0].last;
            })
            .then(function() {
                res.redirect("/thanks");
            })
            .catch(function(err) {
                res.render("edit", {
                    layout: "main",
                    error: "error"
                });
                console.log(err);
            });
    }
});

app.get("/signers", requireUserId, requireSignature, function(req, res) {
    return db
        .getSigners()
        .then(function(result) {
            res.render("signers", {
                layout: "main",
                signers: result.rows,
                helpers: {
                    renderstuff: function(city, age) {
                        if (age && city) {
                            return `<span class="cities">(${age}, <a href="/signers/${city}">${city}</a>)</span>`;
                        } else if (age && !city) {
                            return `<span class="cities">(${age})<span>`;
                        } else if (!age && city) {
                            return `<span class="cities">(<a href="/signers/${city}">${city}</a>)</span>`;
                        } else {
                            return "";
                        }
                    },
                    renderurl: function(url, first, last) {
                        if (url) {
                            return `<a class="links" target="_blank" href="${url}">${first} ${last}</a>`;
                        } else {
                            return `<span class="names">${first} ${last}</span>`;
                        }
                    }
                }
            });
        })
        .catch(function(err) {
            console.log(err);
        });
});

app.get("/signers/:city", function(req, res) {
    return db
        .signersByCity(req.params.city)
        .then(function(result) {
            res.render("citysigners", {
                layout: "main",
                here: req.params.city,
                signers: result.rows,
                helpers: {
                    renderstuff: function(age) {
                        if (age) {
                            return `<span class="cities">(${age})<span>`;
                        } else {
                            return "";
                        }
                    },
                    rendernew: function(url, first, last) {
                        if (url) {
                            return `<a class="links" href="${url}">${first} ${last}</a>`;
                        } else {
                            return `<span class="names">${first} ${last}</span>`;
                        }
                    }
                }
            });
        })
        .catch(function(err) {
            console.log(err);
        });
});

app.get("/logout", requireUserId, function(req, res) {
    req.session = null;
    res.redirect("/register");
});

app.get("*", function(req, res) {
    res.redirect("/");
});

app.listen(process.env.PORT || 8080, () => console.log("I'm listening"));

function requireNoSignature(req, res, next) {
    if (req.session.sigId) {
        return res.redirect("/thanks");
    } else {
        next();
    }
}

function requireSignature(req, res, next) {
    if (!req.session.sigId) {
        return res.redirect("/petition");
    } else {
        next();
    }
}

function requireUserId(req, res, next) {
    if (!req.session.userId) {
        res.redirect("/register");
    } else {
        next();
    }
}

function requireLoggedOut(req, res, next) {
    if (req.session.userId) {
        res.redirect("/petition");
    } else {
        next();
    }
}









RETURNING id;




req.session.userId = data.rows[0].id
