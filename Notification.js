'use strict';

const cheerio = require('cheerio');
const md5 = require('md5');
const log = require('npmlog');

// inti admin
const admin = require('firebase-admin');
const serviceAccount = process.env.ADMIN ? JSON.parse(process.env.ADMIN) : require(`${__dirname}/admin.json`);
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://server-dut.firebaseio.com'
});
const db = admin.database();
const infoHP = db.ref('thong_tin_lop_hoc_phan/');

const dataRef = '/data';
const keyRef = '/key';
const MAIN_QR = '.MsoNormal';
const TITLE_QR = 'span span';
const DAY_QR = 'b span';
const REGEX_URL = /((https|http):\/\/)([\da-z.-]+)\.([a-z.]{0,0})([/\w .-?]*)*\/?/;
const REGEX_HTTP = /[hH][tT][tT][pP]/;
const ZERO = 0;
const DEFAULT_VALUE_KEY = 1;

const NOTI_TYPE = {
    hp: 'tb_lhp',
    chung: 'tbc'
};
const TOPIC_CHUNG = 'TBChung';

log.info('name', admin.app().name);
let listHP;

getListHP();

function getListHP() {
    return new Promise((resolve, reject) => {
        infoHP.once('value', snapshot => {
            log.info('getThongTinLopHocPhan', 'ok');
            listHP = snapshot.val();
            resolve();

        }, err => {
            log.error('The read failed', err.code);
            reject();
        });
    });
}

function textToHtml(_this, html, ix) {
    const $ = cheerio.load(html);
    const tagName = _this.name;
    let text = getText($(_this));
    console.log('_______', ix, text);
    if (tagName === 'br') {
        return '<br>';
    }
    if (!text) {
        return;
    }
    if (tagName === 'a') {
        return toTagA(_this.attribs.href, text);
    }
    if (tagName === undefined) {
        return _this.data.trim().replace(REGEX_URL, link => toTagA(link, link));
    }
    text = $(_this).contents()
        .map((index, elem) => textToHtml(elem, $.html(elem), ix +1)).get().join('');
    return text;
}

/**
 * @param elem: element of cheerio
 * @returns text of element with tag 'a'
 */
function getText(elem) {
    return elem.text().trim().replace(REGEX_URL, link => toTagA(link, link));
}

/**
 * Create html code from text
 * @param link {string}
 * @param text {string}
 * @returns {string}
 */
function toTagA(link, text) {
    if (!link) {
        return text;
    }
    link = link.replace(REGEX_HTTP, a => a.toLowerCase());
    return ` <a href='${link}'>${text}</a>`;
}

/**
 * Get full code of class with (end of class and name)
 * @param className: '15_83A'
 * @param name: 'ĐA Tổ chức thi công'
 * @returns {string} '1180153_1720_15_83A'
 */
function getClassCode(className, name) {
    for (const topic in listHP) {
        if (listHP.hasOwnProperty(topic) && topic.indexOf(className) >= ZERO
            && listHP[topic].tenHP.replace(/\+/g, ' ').indexOf(name.trim()) >= ZERO) {
            log.info('topic', topic);
            return topic;
        }
    }
    log.error('failed', {className, name});
    return '';
}

/** *
 * @param title: 'Thông báo đến lớp: [15.Nh83A] ĐA Tổ chức thi công, [xx.Nh92] Đồ án Tổ chức thi công'
 * @returns ['1180153_1720_15_83A']
 */
function getAllClass(title) {
    const parts = title.split(',');
    const allClass = [];
    for (const part of parts) {
        const regex = part.match(/\[.*?]/);
        if (!regex) {
            continue;
        }

        // Ex: '[15.Nh71]'
        let className = regex[ZERO];

        // Ex: ' Kết cấu CT (BT Thép)'
        const name = part.split(className)[1];

        // Ex: '15_71'
        className = className.replace('[', '').replace(']', '').replace('.Nh', '_');
        if (name && className) {
            const classCode = getClassCode(className, name);
            classCode && allClass.push(classCode);
        }
    }
    return allClass;
}

function sendNotification(noti) {
    let type = NOTI_TYPE.hp;
    if (noti.maHP.length === ZERO) {
        type = NOTI_TYPE.chung;
        noti.maHP.push(TOPIC_CHUNG);
    }
    const payload = {
        data: {
            thoi_gian: noti.day.replace(':', ''),
            tieu_de: noti.event,
            noi_dung: noti.content,
            id: noti.key,
            type: type,
            screen: 'main',
            title: noti.day + noti.event,

            // remove html tag
            body: noti.content.replace(/<.*?>/g, '').trim()
        }
    };
    console.log(payload);
    for (const maHP of noti.maHP) {

        console.log(maHP);
        maHP && admin.messaging().sendToTopic(maHP, payload)
            .then(res => {
                log.info('Successfully sent message:', res);
            })
            .catch(err => {
                log.error('Error sending message:', err);
            });
    }
}

module.exports = class Notification {
    constructor(ref) {
        this.dataRef = db.ref(ref).child(dataRef);
        this.keyRef = db.ref(ref).child(keyRef);
    }

    update(raw) {
        const $ = cheerio.load(raw);

        let mDay = '';
        let mContent = '';
        let mTitle = '';
        const arr = [];

        // check to add prepare-array data
        const push = (day, content, event) => {
            const hash = `${day}:${event}:${content}`,
                key = md5(hash);
            content = content.trim();

            if (!listHP) {
                log.info('listHP', 'loading...');
                throw new Error('listHP is not init');
            }

            const maHP = getAllClass(event);

            const noti = {day, content, event, key, maHP};

            // check key is exists
            this.keyRef.once('value', snapshot => {
                if (snapshot.hasChild(key)) {

                    // log.info('exists', key);
                } else {
                    log.info('not exists', key);

                    // set key
                    this.keyRef.child(key).set(DEFAULT_VALUE_KEY);
                    sendNotification(noti);
                }
            });

            arr.push(noti);
        };

        $('body').contents()
            .filter((index, elem) => {
                if ($(elem).not(MAIN_QR).length === 1) {

                    // this is content
                    const text = textToHtml(elem, $.html(elem), 0);
                    console.log('text', text);
                    if (text) {
                        mContent += text;
                    }
                } else {

                    // is MAIN_QR: title + day, push before get it
                    push(mDay, mContent, mTitle);

                    mDay = $(elem).find(DAY_QR).text();
                    mTitle = $(elem).find(TITLE_QR).text();

                    // remove old content
                    mContent = '';
                }
            });

        // Remove empty element
        arr.shift();
        this.dataRef.set(arr);
    }
};
