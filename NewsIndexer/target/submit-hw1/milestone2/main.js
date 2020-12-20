/**
 * 
 */

var port = 8081;

const express = require('express');
const app = new express();
const path = require("path");
const stemmer = require("stemmer");

const AWS = require("aws-sdk");

const {DynamoDB, QueryCommand } = require('@aws-sdk/client-dynamodb-v2-node');

AWS.config.loadFromPath('./config.json');

const client = new AWS.DynamoDB();

app.set("view engine", "pug");
app.set("views", path.join(__dirname, "views"))

app.get('/', function(request, response) {
    response.sendFile('html/index.html', { root: __dirname });
});

app.get('/talks', function(request, response) {
  var docClient = new AWS.DynamoDB.DocumentClient();

  console.log(request.query.keyword);
  //loads table and gets keyword values 
  	  var params = {
		      TableName : "inverted",
		      KeyConditionExpression: "#kw = :keyw",
		      ExpressionAttributeNames:{
		          "#kw": "keyword"
		      },
		      ExpressionAttributeValues: {
		          ":keyw": request.query.keyword
		      }
		  }; 
 
  //blank array which will eventually contain the results of the query  
 let results = [];
 
 //function that actually queries 
  docClient.query(params, function(err, data) {
      if (err) {
    	  //if query fails, prints message 
          console.error("Unable to query. Error:", JSON.stringify(err, null, 2));
      } else {
    	  //if query succeeds, adds to result array  
          console.log("Query succeeded.");
          data.Items.forEach(function(item) {
        	  results.push(item.url);
          });
          response.render("results", { "search": request.query.keyword, "results": results });
      }
  }); 
});
 
app.listen(port, () => {
  console.log(`HW1 app listening at http://localhost:${port}`)
})
