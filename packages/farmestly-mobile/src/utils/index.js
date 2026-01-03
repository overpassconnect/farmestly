
//Object access using dot notation
const dot = {
    set: function (o, s, value) {
        let a = s.split('.');
        let index = 0;
        (function follow(pointer) {
            if (index < a.length - 1) {
                if (!pointer.hasOwnProperty(a[index])) pointer[a[index]] = {};
                index++;
                follow(pointer[a[index - 1]]);
            } else {
                pointer[a[index]] = value;
            }
        })(o);
    },
    get: function (o, s) {
        if (!s.includes('.')) return o[s];
        let a = s.split('.');
        let pointer = o;
        //TODO: this may be the iterative way of the recursion above!
        for (let key of a) {
            if (pointer.hasOwnProperty(key)) pointer = pointer[key];
            //Break the first time a subobject does not exist
            else return undefined;
        }
        return pointer;
    }
}

const decimalsTruncateTo = (n, d = 4) => parseFloat(n.toString().substring(0, 3 + d));


function urlObjectToUrlString(urlObject) {
    if (urlObject) {
        let l = urlObject.length;
        let s = "";
        for (let key in urlObject)
            s += key + "=" + encodeURIComponent(urlObject[key]) + "&";
        s = s.substring(0, s.length - 1);
        return s;
    } else return "";
}
function isObject(x) { return typeof x === 'object' && !Array.isArray(x) && x !== null; }


function deepCompare(o1, o2, callback) {
    for (let key in o1) {
        if (o1.hasOwnProperty(key)) {
            let currentNode1 = o1[key];
            let currentNode2 = o2[key];
            if (!isObject(currentNode1)) callback(key, o2[key]);
            else deepCompare(currentNode1, currentNode2, callback);
        }
    }
}




// module.exports = {
//     urlObjectToUrlString, isObject, deepCompare, dot
// }

export default { urlObjectToUrlString, isObject, deepCompare, decimalsTruncateTo, dot }

