const _ = require('lodash');
const getFilterDeep = require('deepdash/getFilterDeep');
const getPickDeep = require('deepdash/getPickDeep');

const filterDeep = getFilterDeep(_);
const pickDeep = getPickDeep(_);

const arr = [[{ a: 'a'} , 'b']]

const arr2 = [[{ a: [[{a: 'a'}, { b: 'a'}]]}]]

const arr3 = [{ path: '', filter: '=', value: [[ { path: 'id', value: 2, filter: '!=' }, { path: 'id', value: 2, filter: '!=' } ]] }]

console.log(JSON.stringify(filterDeep(arr3, (value, key, parent) => { 
    console.log(value)
    return parent.filter === '='
}), null, 2))