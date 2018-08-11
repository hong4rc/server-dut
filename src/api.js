'use strict';
const request = require('request').defaults({jar: true});
const cheerio = require('cheerio');
const log = require('npmlog');


const URL_TB = 'http://daotao.dut.udn.vn/sv/G_Thongbao.aspx';
const URL_HP = 'http://daotao.dut.udn.vn/sv/G_Thongbao_LopHP.aspx';

const utils = require('./utils');
const Notification = require('../Notification');

const nChung = new Notification('chung');
const nLopHP = new Notification('lop_hoc_phan');

const URL_HOME = 'http://daotao.dut.udn.vn/sv/';
const QR_LOGIN = '#ctl01 input';

const makeTrigger = (body, jar) => {
    const $ = cheerio.load(body);
    const form = {};
    $(QR_LOGIN).map((index, elem) => {
        const name = $(elem).attr('name');
        const val = $(elem).val();
        if (val && name) {
            form[name] = val;
        }
    });


    log.info('form', form);

    log.info('Trigger', 'Sending ...');
    return utils.post(URL_HOME, jar, form)
        .then(utils.saveCookies(jar));
};

const loadPage = () => new Promise(() => {
    const jar = request.jar();
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
