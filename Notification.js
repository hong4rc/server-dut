'use strict';

const cheerio = require('cheerio');
const md5 = require('md5');
const log = require('npmlog');

//inti admin
const admin = require('firebase-admin');
let serviceAccount = process.env.ADMIN ? JSON.parse(process.env.ADMIN) : require(__dirname + '/admin.json');
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://server-dut.firebaseio.com'
});
let db = admin.database();
let infoHP = db.ref('thong_tin_lop_hoc_phan/');

const dataRef = '/data';
const keyRef = '/key';
const MAIN_QR = '.MsoNormal';
const TITLE_QR = 'span span';
const DAY_QR = 'b span';
const REGEX_URL = /((https|http):\/\/)([\da-z\.-]+)\.([a-z\.]{0,0})([\/\w \.-\?]*)*\/?/;
const REGEX_HTTP = /[hH][tT][tT][pP]/;

const NOTI_TYPE = {
    hp: "tb_lhp",
    chung: "tbc"
};//["tb_lhp", "tbc"];
const TOPIC_CHUNG = "TBChung";

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
    })
}

function textToHtml(elem) {
    let $ = cheerio.load(elem);
    let tagName = $(this)[0].tagName;
    let text = getText($(this));
    if (tagName === 'br') {
        return '<br>';
    }
    if (!text) {
        return;
    }
    if (tagName === 'a') {
        return toTagA($(this).attr('href'), text);
    }
    if (!$(this).html()) {
        return text;
    }
    text = $(this).contents()
        .map(function () {
            if (this.type === 'text') {
                return getText($(this));
            }
            return textToHtml.bind(this)($.html(this));
        }).get().join('');
    return text;
}

function getText(elem) {
    return elem.text().trim().replace(REGEX_URL, (link) => toTagA(link, link));
}

/***
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

function getClassCode(className, name) {
    for (let topic in listHP) {
        if (listHP.hasOwnProperty(topic) && topic.indexOf(className) >= 0
            && listHP[topic].tenHP.replace(/\+/g, ' ').indexOf(name.trim()) >= 0) {
            log.info('topic', topic);
            return topic;
        }
    }
    log.error('failed', {className, name});
    return '';
}

/***
 * @param title {string}
 */
function getAllClass(title) {
    let parts = title.split(',');
    let allClass = [];
    for (let part of parts) {
        let regex = part.match(/\[.*?]/);
        if (!regex) {
            continue;
        }
        let className = regex[0];                   // Ex: '[15.Nh71]'
        let name = part.split(className)[1];        //Ex: ' Kết cấu CT (BT Thép)'
        className = className.replace('[', '').replace(']', '').replace('.Nh', '_');    //Ex: '15_71'
        if (name && className) {
            let classCode = getClassCode(className, name);
            classCode && allClass.push(classCode);
        }
    }
    return allClass;
}

function sendNotification(noti) {
    let type = NOTI_TYPE.hp;
    if (noti.maHP.length === 0) {
        type = NOTI_TYPE.chung;
        noti.maHP.push(TOPIC_CHUNG)
    }
    let payload = {
        data: {
            thoi_gian: noti.day.replace(":", ""),
            tieu_de: noti.event,
            noi_dung: noti.content,
            id: noti.key,
            type: type,
            screen: "main",
            title: noti.day + noti.event,
            body: noti.content.replace(/<.*?>/g, "").replace(/<.*?>/g, "").trim()
        }
    };
    console.log(payload);
    for (let maHP of noti.maHP) {

        console.log(maHP);
        maHP && admin.messaging().sendToTopic(maHP, payload)
            .then(res => {
                log.info("Successfully sent message:", res);
            })
            .catch(err => {
                log.error("Error sending message:", err);
            });
    }
}

module.exports = class Notification {
    constructor(ref) {
        this.dataRef = db.ref(ref).child(dataRef);
        this.keyRef = db.ref(ref).child(keyRef);
    }

    update(raw) {
        let $ = cheerio.load(raw);

        let mDay = '';
        let mContent = '';
        let mTitle = '';
        let arr = [];

        let push = (day, content, event) => {
            let hash = day + ':' + event + ':' + content, key = md5(hash);
            content = content.trim();

            if (!listHP) {
                log.info('listHP', 'loading...');
                throw new Error('listHP is not init')
            }

            let maHP = getAllClass(event);

            let noti = {day, content, event, key, maHP};

            this.keyRef.once('value', snapshot => {
                if (snapshot.hasChild(key)) {
                    // log.info('exists', key);
                } else {
                    log.info('not exists', key);

                    //set key
                    this.keyRef.child(key).set(1);


                    sendNotification(noti);
                }
            });

            arr.push(noti);
        };

        $('body').contents()
            .filter(function () {
                if ($(this).not(MAIN_QR).length === 1) {
                    // this is content
                    let text = textToHtml.bind(this)($.html(this));
                    if (text) {
                        mContent += text;
                    }
                } else {
                    push(mDay, mContent, mTitle);

                    mDay = $(this).find(DAY_QR).text();
                    mTitle = $(this).find(TITLE_QR).text();
                    mContent = '';
                }
            });
        arr.shift();
        this.dataRef.set(arr);
    }
};