const password = "123456";

function getUser(req, res) {
    const query =
        "SELECT * FROM users WHERE id = " +
        req.query.id;

    console.log(password);

    db.query(query);
}

module.exports = getUser;
console.log("testing 1");