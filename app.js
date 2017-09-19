'use strict';

var express = require("express");
var app = express();
var cfenv = require("cfenv");
var request = require("request");
var Promise = require("bluebird")
var request = Promise.promisify(require("request"));
const NodeCache = require("node-cache");
const departureCache = new NodeCache( { stdTTL: 60, checkperiod: 120 } );;

const requestString = "http://efa2.naldo.de/naldo/XSLT_DM_REQUEST?language=de&useRealtime=1&mode=direct&type_dm=stop&name_dm=${%20Reutlingen%20}%20${%20Breitenbach%20}&mId=efa_rc2&outputFormat=JSON&line=tub:07002:%20:H:j17&line=tub:07007:%20:R:j17&limit=10;"

function extractTime(departure) {
  let depTime = departure.realDateTime || departure.dateTime
  return depTime.hour + ":" + depTime.minute
}

function extractDepartures(departuresList) {
  var departures = new Map();
  departuresList.forEach(departure => {
    if (!departures.get('7') && departure.servingLine.number == '7') {
      departures.set('7', extractTime(departure))
    }
    if (!departures.get('2') && departure.servingLine.number == '2') {
      departures.set('2', extractTime(departure))
    }
  })
  return departures;
}

function getDepartures() {
  return new Promise((resolve, reject) => {

    request(requestString)
      .then(response => {
        let answer = JSON.parse(response.body);
        let departures = extractDepartures(answer.departureList)
        resolve(
          {
            "frames": [
              {
                "text": "Linie 2: " + departures.get('2'),
                "icon": "a6175"
              },
              {
                "text": "Linie 7: " + departures.get('7'),
                "icon": "a6175"
              }
            ]
          })
      })
      .catch(error => 
        resolve(
          {
            "frames": [
              {
                "text": "Error",
                "icon": "a6175"
              }
            ]
          }))

})}

app.get("/departures", function (request, response) {
  if (departureCache.get('departures')) {
    response.send(departureCache.get('departures'));
  } else {
    getDepartures()
    .then(result => {
      departureCache.set('departures', result);
      response.send(result);
    })
    .catch(error => 
      response.send(
        {
          "frames": [
            {
              "text": "Error",
              "icon": "a6175"
            }
          ]
        }))
  }
});

// load local VCAP configuration  and service credentials
var vcapLocal;
try {
  vcapLocal = require('./vcap-local.json');
  console.log("Loaded local VCAP", vcapLocal);
} catch (e) { }

const appEnvOpts = vcapLocal ? { vcap: vcapLocal} : {}
const appEnv = cfenv.getAppEnv(appEnvOpts);

var port = process.env.PORT || 3000
app.listen(port, function() {
    console.log("To view your app, open this link in your browser: http://localhost:" + port);
});

