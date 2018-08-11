'use strict';
const api = require('./src/api');
const fs = require('fs');

const express = require('express');
const app = express();

app.get('/', (req, res) => {
    res.writeHead(200, {
        'Content-Type': 'text/json; charset=utf-8'
    });
    const date = new Date();
    date.setUTCHours(date.getUTCHours() + /* VN timeZone */ 7 + date.getTimezoneOffset() / 60);
    const nowTime = `${date.getHours()}:${date.getMinutes()}`;
    const data = {
        status: 'App is running',
        time: nowTime
    };
    res.end(JSON.stringify(data, null, 4));
});

// app.use(express.static('public'));
const port = process.env.PORT || 1997;
const delayTime = process.env.DELAY_TIME || 5 * 60 * 1000; // default is 5 min
app.listen(port, () => console.log('This app is running in Port: ', port));

const loadFeed = () => {

    setTimeout(api.loadPage, 10000);

    setInterval(api.loadPage, delayTime);
};
loadFeed();
