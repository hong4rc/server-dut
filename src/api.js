'use strict';
let request = require('request').defaults({jar: true});
let cheerio = require('cheerio');
let log = require('npmlog');
let fs = require('fs');


const URL_TB = 'http://daotao.dut.udn.vn/sv/G_Thongbao.aspx';
const URL_HP = 'http://daotao.dut.udn.vn/sv/G_Thongbao_LopHP.aspx';

let utils = require('./utils');
let Notification = require('../Notification');

let nChung = new Notification('chung');
let nLopHP = new Notification('lop_hoc_phan');

const URL_HOME = 'http://daotao.dut.udn.vn/sv/';
const QR_LOGIN = '#ctl01 input';

let makeTrigger = (body, jar) => {
    let $ = cheerio.load(body);
    let form = {};
    $(QR_LOGIN).map((index, elem) => {
        let name = $(elem).attr('name');
        let val = $(elem).val();
        if (val && name) {
            form[name] = val;
        }
    });


    log.info('form', form);

    log.info('Trigger', 'Sending ...');
    return utils.post(URL_HOME, jar, form)
        .then(utils.saveCookies(jar));
};

let loadPage = () => new Promise(() => {
    let jar = request.jar();
    return utils.get(URL_HOME)
        .then(utils.saveCookies(jar))
        .then(res => makeTrigger(res.body, jar))
        .then(() => {
            log.info('Trigger', 'Success !!!');
            utils.get(URL_HP, jar).then(res => {
                nLopHP.update(res.body);
            });

            utils.get(URL_TB, jar).then(res => {
                nChung.update(res.body);
            });
        });
});


module.exports = {loadPage};