let fs = require('fs');
let request = require('request').defaults({jar: true});
let getHeaders = url => {
    return {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': 'http://daotao.dut.udn.vn/sv/',
        'Host': url.replace('http://', '').split("/")[0],
        'Origin': 'http://daotao.dut.udn.vn/sv/',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/600.3.18 (KHTML, like Gecko) Chrome/63.0.3239.84 Version/8.0.3 Safari/600.3.18',
        'Connection': 'keep-alive',
    }
};
let method = (method) => (url, jar, form, qs) => {
    let option = {
        headers: getHeaders(url),
        timeout: 60000,
        url: url,
        method: method,
        jar: jar,
        gzip: true
    };
    if (method.toUpperCase() === 'GET') {
        option.qs = form;
    } else {
        option.form = form
    }
    if (qs) {
        option.qs = qs;
    }

    return new Promise(resolve => {
        request(option, (err, res) => {
            // fs.writeFileSync('index.html', res.body);
            resolve(res);
        })
    });
};
let get = method("GET");
let post = method("POST");

let saveCookies = (jar) => res => {
    let cookies = res.headers['set-cookie'] || [];
    cookies.forEach(c => {
        console.log(1, c);
        if (c.indexOf(".dut.udn.vn") > -1) {
            jar.setCookie(c, "http://daotao.dut.udn.vn");
        } else {
            console.log(2, c);

            jar.setCookie(c, "http://daotao.dut.udn.vn");
        }
    });
    return res;
};
let findForm = (body, head, tail) => {
    let start = body.indexOf(head) + head.length;
    if (start < head.length) return "";

    let lastHalf = body.substring(start);
    let end = lastHalf.indexOf(tail);
    if (end === -1) {
        throw Error(`Could not find endTime ${tail} in the given string.`);
    }
    return lastHalf.substring(0, end);
};

let formatCookie = (arr, url) => {
    return arr[0] + "=" + arr[1] + "; Path=" + arr[3] + "; Domain=" + url;
};
let getAppState = jar => jar
    .getCookies("http://daotao.dut.udn.vn")
    .concat(jar.getCookies("http://daotao.dut.udn.vn"));


let makeDefaults = (body, id, ctx) => {
    let reqCounter = 1;
    let fb_dtsg = findForm(body, "name=\"fb_dtsg\" value=\"", "\"");
    let ttstamp = "2";
    for (let i = 0; i < fb_dtsg.length; i++) {
        ttstamp += fb_dtsg.charCodeAt(i);
    }
    let revision = findForm(body, "revision\":", ",");

    let mergeWithDefaults = (obj) => {
        let mObj = {
        };

        if (!mObj) return obj;

        for (let prop in obj) {
            if (obj.hasOwnProperty(prop)) {
                if (!mObj[prop]) {
                    mObj[prop] = obj[prop];
                }
            }
        }

        return mObj;
    };
    let mergePost = (url, jar, form) => {
        return post(url, jar, mergeWithDefaults(form));
    };

    let mergeGet = (url, jar, qs) => {
        return get(url, jar, mergeWithDefaults(qs));
    };

    let mergePostForm = (url, jar, form, qs) => {
        return post(url, jar, mergeWithDefaults(form), mergeWithDefaults(qs));
    };

    return {
        get: mergeGet,
        post: mergePost,
        postFormData: mergePostForm,
    };
};

module.exports = {
    get,
    post,
    saveCookies,
    findForm,
    formatCookie,
    getAppState,
    makeDefaults
};