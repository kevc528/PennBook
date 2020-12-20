var db = require('./database.js');
const http = require('http');
const axios = require('axios')
const config = require('../config')

const TABLE_NAME = 'news-recommendations-info';
const INTEREST_JOB_NAME = 'interest';
const FULL_JOB_NAME = 'full';
const HOURLY_JOB_NAME = 'hourly';
const INCOMPLETE_STATUSES = ['running', 'starting', 'submitted', 'relaunching', 'waiting'];

/**
 * Get all the news info from a news link
 */
var getNewsByLink = function(link, callback) {
    let params = {
        "TableName": TABLE_NAME,
        "KeyConditionExpression": "link = :v_link",
        "ExpressionAttributeValues": {
            ":v_link": link,
        }
    }
    db.dynamoDB_query(params, function(err, data) {
        if (err) {
            callback(err, null)
        } else if (data.Items.length) {
            callback(err, data.Items[0]);
        } else {
            callback("No news found with provided link", data.Items)
        }
    })
}

const JOB_TYPE = {
    'INTEREST': 0,
    'HOURLY': 1
}

/**
 * Invokes spark job for creating new recs - complex setup... need to mvn package Recommender java project, 
 * upload SNAPSHOT jar to S3 bucket named nets212-recommender (with public properties), change EMR_LIVY_URL  
 * in the config.js file to the Livy url provided by EMR cluster
 * 
 * @param {*} type what caused the job to run
 * No need for callback - will print to console and fail silently
 */
var callRecommendJob = function(type) {
    axios.get(`${config.EMR_LIVY_URL}/batches`)
        .then(function (response) {
            if (type) {
                console.log('HOURLY UPDATE LIVY CALL')
                if (response.data.sessions.some(x => (x.name.startsWith(FULL_JOB_NAME) && INCOMPLETE_STATUSES.includes(x.state)) 
                        || (x.name.startsWith(HOURLY_JOB_NAME) && INCOMPLETE_STATUSES.includes(x.state)))) {
                    console.log('SKIPPING JOB - FULL JOB OR HOURLY IS STILL RUNNING')
                } else {
                    response.data.sessions.forEach(
                        session => {
                            axios.delete(`${config.EMR_LIVY_URL}/batches/${session.id}`)
                                .then(function(response) {
                                    console.log(`DELETE BATCH ${session.id}`)
                                })
                                .catch(function(error) {
                                    console.log(error)
                                })
                        }
                    )
                    invokeSpark(config.SPARK_RECS_MAIN_CLASS, HOURLY_JOB_NAME)
                }
            } else {
                console.log('INTEREST UPDATE LIVY CALL')
                if (response.data.total && response.data.sessions.some(x => INCOMPLETE_STATUSES.includes(x.state))) {
                    console.log('SKIPPING JOB - ONE IS CURRENTLY IN PROGRESS')
                } else {
                    invokeSpark(config.SPARK_RECS_MAIN_CLASS, INTEREST_JOB_NAME)
                }
            }
        })
        .catch(function (error) {
            console.log(error);
        })
}

/**
 * Call entire spark job, including adding the weights
 */
var callFullJob = function() {
    axios.get(`${config.EMR_LIVY_URL}/batches`)
        .then(function (response) {
            console.log('INVOKING FULL SPARK JOB - THIS WILL TAKE A WHILE')
            response.data.sessions.forEach(
                session => {
                    axios.delete(`${config.EMR_LIVY_URL}/batches/${session.id}`)
                        .then(function(response) {
                            console.log(`DELETE BATCH ${session.id}`)
                        })
                        .catch(function(error) {
                            console.log(error)
                        })
                }
            )
            invokeSpark(config.SPARK_FULL_MAIN_CLASS, FULL_JOB_NAME)
        })
        .catch(function (error) {
            console.log(error);
        })
}

/**
 * Helper to invoke spark job
 * @param {*} mainClass this is the main class for the job we want to run
 * @param {*} name this is the name of batch - good for identifying full vs. rec
 */
var invokeSpark = function(mainClass, name) {
    console.log('INVOKING SPARK JOB');

    axios.post(`${config.EMR_LIVY_URL}/batches`, {
        name: `${name}${Date.now()}`,
        file: config.SPARK_JAR,
        className: mainClass
    })
    .then(res => {
        console.log(`statusCode: ${res.statusCode}`)
    })
    .catch(error => {
        console.error(error)
    })
}


var news_model = {
    get_news_by_link: getNewsByLink,
    call_recommend_job: callRecommendJob,
    call_full_job: callFullJob,
    JOB_TYPE: JOB_TYPE
}

module.exports = news_model;
