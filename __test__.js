"use strict";
function a() {
    return new Promise((a, b)=>{
        setTimeout(()=>{
            a('dd');
        }, 5000)
    });
}
async function aaa() {
    console.log('df');
    await a();
    console.log('df2');
}
aaa();