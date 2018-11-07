var server = require('../../server');
var app = server.app;
var path = require('path');
var fs = require('fs');
var crypto = require('crypto');
var db = require('../server/db/database');

const SALT_LENGTH = 8;

/**
 * 
 * @param {String} username name of the user
 * @param {function(Object, Object):void} callback 
 */
function selectUserFromDb(username, callback) {
    let con = server.db.getConnection();
    con.query('SELECT * FROM web.users WHERE username = ?;', [username], (err, results, fields) => {
        callback(results, fields);
    });
}

/**
 * Retrieve userdata from MySql server as a JSON object in a callback.
 * @param {String} name username
 * @param {function(JSON):void} callback 
 */
function getUserAsJSON(name, callback) {
    selectUserFromDb(name, (data) => {
        if (data == null) {data = {};}
        if (data.length > 0) {
            var json = JSON.stringify(data[0]);
            callback(json);
        }
    });
}

module.exports = {

    sqlResultsIntoObject(results) {
        let obj = {};
        for (let i = 0; i < results.length; i++) {
        }
        return obj;
    },

    /**
     * Setup server response for /user paths
     */
    handleUserPaths() {
        /**
         * Request profile data for username
         */
        app.get('/user/profile', (req, res) => {

            const username = req.query.username;

            this.getProfile(username, (profile) => {
                res.send(profile);
            });
        });

        /**
         * Request logintoken for account
         */
        app.get('/user/login', (req, res) => {
            const username = req.query.username;
            const password = req.query.password;

            this.requestLoginToken(username, password)
            .then((val) => {
                res.send(JSON.stringify({valid: val}));
            });
        });
    },

    /**
     * I did not write this function.
     * @param {int} len 
     */
    randomHexValue(len) {
        var maxlen = 8,
        min = Math.pow(16,Math.min(len,maxlen)-1) 
        max = Math.pow(16,Math.min(len,maxlen)) - 1,
        n   = Math.floor( Math.random() * (max-min+1) ) + min,
        r   = n.toString(16);
        while ( r.length < len ) {
            r = r + randHex( len - maxlen );
        }
        return r;
    },

    encryptString(s) {
        let hash = crypto.createHash('md5');
        hash.update(s);
        return hash.digest('hex');
    },

    /**
     * @param {Request} req 
     */
    processUserCreate(req) {
        let passobj = this.encryptPassword(req);
        let pass = passobj.pass;
        let salt = passobj.salt;
        let con = db.getConnection();
        con.query('INSERT INTO web.users (username, password, firstName, lastName, salt) VALUES (?, ?, ?, ?, ?)',
        [
            req.body.username,
            pass,
            req.body.firstname,
            req.body.lastname,
            salt
        ]);
    },

    /**
     * @param {Request} req 
     */
    encryptPassword(req) {
        let salt = this.randomHexValue(SALT_LENGTH);
        let encryptedPass = this.encryptString(req.body.password + salt);
        return {pass: encryptedPass, salt: salt};
    },

    handlePost() {
        app.post('/user/create', (req, res) => {
            this.processUserCreate(req);
            res.send('nice');
        });
    },

    requestLoginToken(username, password) {
        return this.authenticatePassword(username, password);
    },

    authenticatePassword(username, password) {
        let run = (callback) => getUserAsJSON(username, (json) => {

            let user = JSON.parse(json);
            let passwordToTest = this.encryptString(password + user.salt);

            let valid = passwordToTest == user.password;
            callback(valid);
        });

        return new Promise((resolve, reject) => {

            if (username == '' || password == '') {
                resolve(false);
            }
            else {
                run((passwordIsCorrect) => resolve(passwordIsCorrect));
            }
        });
    },

    /**
     * @param {String} name 
     * @param {function(Object):void} callback 
     */
    getProfile(name, callback) {
        getUserAsJSON(name, (json) => callback(json));
    }
};