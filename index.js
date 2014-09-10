var debug = require('debug');
var assert = require('assert');
var Benchmark = require('benchmark');
var fs = require('fs');
var path = require('path');

// protobuf
var Schema = require('protobuf').Schema;
var schema = new Schema(fs.readFileSync('./packet.desc'));
var Account = schema['packet.Account'];
var LoginResponse = schema['packet.LoginResponse'];
// console.log('Account', Account);
// console.log('LoginResponse', LoginResponse);

// node-protobuf
var node_protobuf = require("node-protobuf");
var pb2 = new node_protobuf(fs.readFileSync("packet.desc"));

// protocol-buffers
var protocol_buffers = require('protocol-buffers');
var pb3 = protocol_buffers(fs.readFileSync('packet.proto'));
// console.log(pb3);

// protobuf.js
var ProtoBuf = require('protobufjs');
var builder = ProtoBuf.loadProtoFile(path.normalize('packet.proto'));
var pb4 = builder.build('packet');

function diff(x, y) {
    assert.equal(x.id, y.id);
    if (y.accessToken)
        assert.equal(x.accessToken, y.accessToken);

    // error
    // assert.equal(x.error.category, y.error.category);
    if (y.error != null) {
        if (y.error.message != null)
            assert.equal(x.error.message, y.error.message);
        if (y.error.code)
            assert.equal(x.error.code, y.error.code);
    }

    // account
    if (y.account != null) {
        assert.equal(x.account.id, y.account.id);
        assert.equal(x.account.userID, y.account.userID);
    }

    // items
    if (y.items.length > 0) {
        assert.equal(x.items.length, y.items.length);
        for(var i = 0 ; i < x.items.length ; i ++) {
            var a = x.items[i];
            var b = y.items[i];

            assert.equal(a.id, b.id);
            assert.equal(a.category, b.category);
            assert.equal(a.count, b.count);
        }
    }
}

function run(itemCount) {

    itemCount = itemCount || 0;

    var items = [];
    for(var i = 0 ; i < itemCount ; i++) {
        items.push({
            id: i + 1,
            category: 'weapon',
            count: i + 1,
        });
    }

    var json = {
        id: 123456789,
        accessToken: "12345678901234567890",
        error: {
            category: 500,
            message: "invalid protocol buffer",
            code: -100
        },
        account: {
            id: 123456789,
            userID: 'who@gmail.com',
            // what: 'the hell'
        },
        items: items,
    };


    console.log('\n##', itemCount, 'items ##\n');

    var encoded = {};
    var decoded = {};

    encoded['json'] = JSON.stringify(json);
    decoded['json'] = JSON.parse(encoded['json']);

    encoded['protobuf'] = LoginResponse.serialize(json);
    decoded['protobuf'] = LoginResponse.parse(encoded['protobuf']);

    encoded['node-protobuf'] = pb2.serialize(json, "packet.LoginResponse");
    decoded['node-protobuf'] = pb2.parse(encoded['node-protobuf'], "packet.LoginResponse");

    encoded['protocol-buffers'] = pb3.LoginResponse.encode(json);
    decoded['protocol-buffers'] = pb3.LoginResponse.decode(encoded['protocol-buffers']);

    encoded['protobufjs'] = (new pb4.LoginResponse(json)).encodeNB();
    decoded['protobufjs'] = pb4.LoginResponse.decode(encoded['protobufjs']);

    for(var k in encoded) {
        console.log(k, ':', encoded[k].length, 'bytes');
    }

    for(var k2 in decoded) {
        diff(decoded[k2], json);
    }

    // protobufjs/protocol-buffers encode sint32/sint64 with zigzag encoding (protobuf-net too)
    diff(pb4.LoginResponse.decode(encoded['protocol-buffers']), json);
    diff(pb3.LoginResponse.decode(encoded['protobufjs']), json);

    // protobuf/node-protobuf does not.
    diff(LoginResponse.parse(encoded['node-protobuf']), json);
    diff(pb2.parse(encoded['protobuf'], "packet.LoginResponse"), json);

    //
    var suite = new Benchmark.Suite();
    suite.add('JSON', function() {
        JSON.parse(JSON.stringify(json));
    })
    .add('protocol-buffers', function() {
        pb3.LoginResponse.decode(pb3.LoginResponse.encode(json));
    })
    .add('protobuf', function() {
        LoginResponse.parse(LoginResponse.serialize(json));
    })
    .add('node-protobuf', function() {
        pb2.parse(pb2.serialize(json, "packet.LoginResponse"), "packet.LoginResponse");
    })
    .add('protobufjs', function() {
        pb4.LoginResponse.decode((new pb4.LoginResponse(json)).encodeNB());
    })
    .on('complete', function() {
        this.forEach(function(bench) {
            console.log('-', bench.toString());
        });
    })
    .run();
    // .run({ async: true });
}

for(var i = 0 ; i <= 1000 ; i += 100) {
    run(i);
}