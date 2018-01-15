"use strict";
let api = require('./src/api');
const fs = require('fs');


let loadFeed = () => {

    setTimeout(api.loadPage, 10000);

    setInterval(api.loadPage, 30 * 60 * 1000);
};
loadFeed();