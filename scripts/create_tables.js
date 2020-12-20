var AWS = require('aws-sdk');
AWS.config.update({region:'us-east-1'});
var db = new AWS.DynamoDB();

/**
 * Init a table with just one hashkey
 * @param {*} tableName 
 * @param {*} hashkey 
 */
var initTable = function (tableName, hashkey) {
    db.listTables(function (err, data) {
        if (err) {
            console.log(err, err.stack);
        } else {
            console.log("Connected to AWS DynamoDB");

            var tables = data.TableNames.toString().split(",");
            console.log("Tables in DynamoDB: " + tables);
            if (tables.indexOf(tableName) == -1) {
                console.log("Creating new table '" + tableName + "'");

                var params = {
                    AttributeDefinitions:
                        [
                            {
                                AttributeName: hashkey,
                                AttributeType: 'S'
                            }
                        ],
                    KeySchema:
                        [
                            {
                                AttributeName: hashkey,
                                KeyType: 'HASH'
                            }
                        ],
                    ProvisionedThroughput: {
                        ReadCapacityUnits: 3,       // DANGER: Don't increase this too much; stay within the free tier!
                        WriteCapacityUnits: 3       // DANGER: Don't increase this too much; stay within the free tier!
                    },
                    TableName: tableName /* required */
                };

                db.createTable(params, function (err, data) {
                    if (err) {
                        console.log(err)
                    }
                    else {
                        console.log("Table is being created; waiting for 20 seconds...");
                        setTimeout(function () {
                            console.log("Success");
                        }, 20000);
                    }
                });
            } else {
                console.log("Table " + tableName + " already exists");
            }
        }
    });
}

/**
 * Init a table with one hashkey and one sortkey
 * @param {*} tableName 
 * @param {*} hashkey 
 * @param {*} sortkey
 */
var initTableWithSort = function (tableName, hashkey, sortkey) {
    db.listTables(function (err, data) {
        if (err) {
            console.log(err, err.stack);
        } else {
            console.log("Connected to AWS DynamoDB");

            var tables = data.TableNames.toString().split(",");
            console.log("Tables in DynamoDB: " + tables);
            if (tables.indexOf(tableName) == -1) {
                console.log("Creating new table '" + tableName + "'");

                var params = {
                    AttributeDefinitions:
                        [
                            {
                                AttributeName: hashkey,
                                AttributeType: 'S'
                            },
                            {
                                AttributeName: sortkey,
                                AttributeType: 'S'
                            }
                        ],
                    KeySchema:
                        [
                            {
                                AttributeName: hashkey,
                                KeyType: 'HASH'
                            },
                            {
                                AttributeName: sortkey,
                                KeyType: 'RANGE'
                            }
                        ],
                    ProvisionedThroughput: {
                        ReadCapacityUnits: 3,       // DANGER: Don't increase this too much; stay within the free tier!
                        WriteCapacityUnits: 3       // DANGER: Don't increase this too much; stay within the free tier!
                    },
                    TableName: tableName /* required */
                };

                db.createTable(params, function (err, data) {
                    if (err) {
                        console.log(err)
                    }
                    else {
                        console.log("Table is being created; waiting for 20 seconds...");
                        setTimeout(function () {
                            console.log("Success");
                        }, 20000);
                    }
                });
            } else {
                console.log("Table " + tableName + " already exists");
            }
        }
    });
}

/**
 * Init a table that has a primary AND secondary key
 * @param {*} tableName 
 * @param {*} hashkey hashkey column name as string
 * @param {*} index secondary index column name as string
 */
var initTwoKeyTable = function (tableName, hashkey, index) {
    db.listTables(function (err, data) {
        if (err) {
            console.log(err, err.stack);
        } else {
            console.log("Connected to AWS DynamoDB");

            var tables = data.TableNames.toString().split(",");
            console.log("Tables in DynamoDB: " + tables);
            if (tables.indexOf(tableName) == -1) {
                console.log("Creating new table '" + tableName + "'");

                var params = {
                    AttributeDefinitions:
                        [
                            {
                                AttributeName: hashkey,
                                AttributeType: 'S'
                            },
                            {
                                AttributeName: index,
                                AttributeType: 'S'
                            }
                        ],
                    KeySchema:
                        [
                            {
                                AttributeName: hashkey,
                                KeyType: 'HASH'
                            }
                        ],
                    GlobalSecondaryIndexes: [
                        {
                            IndexName: index + '-index',
                            KeySchema:
                                [
                                    {
                                        AttributeName: index,
                                        KeyType: 'HASH'
                                    }
                                ],
                            Projection: {
                                ProjectionType: "ALL"
                            },
                            ProvisionedThroughput: {
                                ReadCapacityUnits: 3,       // DANGER: Don't increase this too much; stay within the free tier!
                                WriteCapacityUnits: 3       // DANGER: Don't increase this too much; stay within the free tier!
                            }
                        }
                    ],
                    ProvisionedThroughput: {
                        ReadCapacityUnits: 3,       // DANGER: Don't increase this too much; stay within the free tier!
                        WriteCapacityUnits: 3       // DANGER: Don't increase this too much; stay within the free tier!
                    },
                    TableName: tableName /* required */
                };

                db.createTable(params, function (err, data) {
                    if (err) {
                        console.log(err)
                    }
                    else {
                        console.log("Table is being created; waiting for 20 seconds...");
                        setTimeout(function () {
                            console.log("Success");
                        }, 20000);
                    }
                });
            } else {
                console.log("Table " + tableName + " already exists");
            }
        }
    });
}

/**
 * Init a table that has a primary AND secondary key AND sort
 * @param {*} tableName 
 * @param {*} hashkey hashkey column name as string
 * @param {*} sortkey sort key as string
 * @param {*} index secondary index column name as string
 */
var initTwoKeyTableWithSort = function (tableName, hashkey, sortkey, index, indexSort) {
    db.listTables(function (err, data) {
        if (err) {
            console.log(err, err.stack);
        } else {
            console.log("Connected to AWS DynamoDB");

            var tables = data.TableNames.toString().split(",");
            console.log("Tables in DynamoDB: " + tables);
            if (tables.indexOf(tableName) == -1) {
                console.log("Creating new table '" + tableName + "'");

                var params = {
                    AttributeDefinitions:
                        [
                            {
                                AttributeName: hashkey,
                                AttributeType: 'S'
                            },
                            {
                                AttributeName: sortkey,
                                AttributeType: 'S'
                            },
                            {
                                AttributeName: index,
                                AttributeType: 'S'
                            }
                        ],
                    KeySchema:
                        [
                            {
                                AttributeName: hashkey,
                                KeyType: 'HASH'
                            },
                            {
                                AttributeName: sortkey,
                                KeyType: 'RANGE'
                            }
                        ],
                    GlobalSecondaryIndexes: [
                        {
                            IndexName: index + '-index',
                            KeySchema:
                                [
                                    {
                                        AttributeName: index,
                                        KeyType: 'HASH'
                                    }
                                ],
                            Projection: {
                                ProjectionType: "ALL"
                            },
                            ProvisionedThroughput: {
                                ReadCapacityUnits: 3,       // DANGER: Don't increase this too much; stay within the free tier!
                                WriteCapacityUnits: 3       // DANGER: Don't increase this too much; stay within the free tier!
                            }
                        }
                    ],
                    ProvisionedThroughput: {
                        ReadCapacityUnits: 3,       // DANGER: Don't increase this too much; stay within the free tier!
                        WriteCapacityUnits: 3       // DANGER: Don't increase this too much; stay within the free tier!
                    },
                    TableName: tableName /* required */
                };

                if (sortkey === index) {
                    params.AttributeDefinitions.pop()
                    params.GlobalSecondaryIndexes[0].KeySchema[0].AttributeName = sortkey
                }

                if (indexSort) {
                    params.GlobalSecondaryIndexes[0].KeySchema.push(
                        {
                            AttributeName: sortkey,
                            KeyType: 'RANGE'
                        }
                    )
                }

                db.createTable(params, function (err, data) {
                    if (err) {
                        console.log(err)
                    }
                    else {
                        console.log("Table is being created; waiting for 20 seconds...");
                        setTimeout(function () {
                            console.log("Success");
                        }, 20000);
                    }
                });
            } else {
                console.log("Table " + tableName + " already exists");
            }
        }
    });
}

/**
 * Init a table that has a primary AND secondary key
 * @param {*} tableName 
 * @param {*} hashkey hashkey column name as string
 * @param {*} index secondary index column name as string
 */
var initThreeKeyTable = function (tableName, hashkey, index1, index2,sortkey) {
    db.listTables(function (err, data) {
        if (err) {
            console.log(err, err.stack);
        } else {
            console.log("Connected to AWS DynamoDB");

            var tables = data.TableNames.toString().split(",");
            console.log("Tables in DynamoDB: " + tables);
            if (tables.indexOf(tableName) == -1) {
                console.log("Creating new table '" + tableName + "'");

                var params = {
                    AttributeDefinitions:
                        [
                            {
                                AttributeName: hashkey,
                                AttributeType: 'S'
                            },
                            {
                                AttributeName: index1,
                                AttributeType: 'S'
                            },
                            {
                                AttributeName: index2,
                                AttributeType: 'S'
                            },  
                            {
                                AttributeName: sortkey,
                                AttributeType: 'S'
                            },

                            
                            ],
                    KeySchema:
                        [
                            {
                                AttributeName: hashkey,
                                KeyType: 'HASH'
                            }, 
                           
                        ],
                    GlobalSecondaryIndexes: [
                        {
                            IndexName: index1 + '-index',
                            KeySchema:
                                [
                                    {
                                        AttributeName: index1,
                                        KeyType: 'HASH'
                                    }, 
                                  

                                    
                                ],
                            Projection: {
                                ProjectionType: "ALL"
                            },
                            ProvisionedThroughput: {
                                ReadCapacityUnits: 3,       // DANGER: Don't increase this too much; stay within the free tier!
                                WriteCapacityUnits: 3       // DANGER: Don't increase this too much; stay within the free tier!
                            }
                        },
                        {
                            IndexName: index2 + '-index',
                            KeySchema:
                                [
                                    {
                                        AttributeName: index2,
                                        KeyType: 'HASH'
                                    }
                                ],
                            Projection: {
                                ProjectionType: "ALL"
                            },
                            ProvisionedThroughput: {
                                ReadCapacityUnits: 3,       // DANGER: Don't increase this too much; stay within the free tier!
                                WriteCapacityUnits: 3       // DANGER: Don't increase this too much; stay within the free tier!
                            }
                        },
                        {
                            IndexName: sortkey + '-index',
                            KeySchema:
                                [
                                    {
                                        AttributeName: sortkey,
                                        KeyType: 'HASH'
                                    }
                                ],
                            Projection: {
                                ProjectionType: "ALL"
                            },
                            ProvisionedThroughput: {
                                ReadCapacityUnits: 3,       // DANGER: Don't increase this too much; stay within the free tier!
                                WriteCapacityUnits: 3       // DANGER: Don't increase this too much; stay within the free tier!
                            }
                        }
                    ],
                    ProvisionedThroughput: {
                        ReadCapacityUnits: 3,       // DANGER: Don't increase this too much; stay within the free tier!
                        WriteCapacityUnits: 3       // DANGER: Don't increase this too much; stay within the free tier!
                    },
                    TableName: tableName /* required */
                };

                db.createTable(params, function (err, data) {
                    if (err) {
                        console.log(err)
                    }
                    else {
                        console.log("Table is being created; waiting for 20 seconds...");
                        setTimeout(function () {
                            console.log("Success");
                        }, 20000);
                    }
                });
            } else {
                console.log("Table " + tableName + " already exists");
            }
        }
    });
}

/**
 * Init a table that has a primary AND secondary key AND sort
 * @param {*} tableName 
 * @param {*} hashkey hashkey column name as string
 * @param {*} sortkey sort key as string
 * @param {*} index secondary index column name as string
 */
var initTwoKeyTableWithKeySort = function (tableName, hashkey, index, sortkey) {
    db.listTables(function (err, data) {
        if (err) {
            console.log(err, err.stack);
        } else {
            console.log("Connected to AWS DynamoDB");

            var tables = data.TableNames.toString().split(",");
            console.log("Tables in DynamoDB: " + tables);
            if (tables.indexOf(tableName) == -1) {
                console.log("Creating new table '" + tableName + "'");

                var params = {
                    AttributeDefinitions:
                        [
                            {
                                AttributeName: hashkey,
                                AttributeType: 'S'
                            },
                            {
                                AttributeName: sortkey,
                                AttributeType: 'S'
                            },
                            {
                                AttributeName: index,
                                AttributeType: 'S'
                            }
                        ],
                    KeySchema:
                        [
                            {
                                AttributeName: hashkey,
                                KeyType: 'HASH'
                            }
                        ],
                    GlobalSecondaryIndexes: [
                        {
                            IndexName: index + '-index',
                            KeySchema:
                                [
                                    {
                                        AttributeName: index,
                                        KeyType: 'HASH'
                                    }
                                ],
                            Projection: {
                                ProjectionType: "ALL"
                            },
                            ProvisionedThroughput: {
                                ReadCapacityUnits: 3,       // DANGER: Don't increase this too much; stay within the free tier!
                                WriteCapacityUnits: 3       // DANGER: Don't increase this too much; stay within the free tier!
                            }
                        }
                    ],
                    ProvisionedThroughput: {
                        ReadCapacityUnits: 3,       // DANGER: Don't increase this too much; stay within the free tier!
                        WriteCapacityUnits: 3       // DANGER: Don't increase this too much; stay within the free tier!
                    },
                    TableName: tableName /* required */
                };

                params.GlobalSecondaryIndexes[0].KeySchema.push(
                    {
                        AttributeName: sortkey,
                        KeyType: 'RANGE'
                    }
                )

                db.createTable(params, function (err, data) {
                    if (err) {
                        console.log(err)
                    }
                    else {
                        console.log("Table is being created; waiting for 20 seconds...");
                        setTimeout(function () {
                            console.log("Success");
                        }, 20000);
                    }
                });
            } else {
                console.log("Table " + tableName + " already exists");
            }
        }
    });
}

/**
 * Init a table that has a primary AND secondary key AND sort
 * @param {*} tableName 
 * @param {*} hashkey hashkey column name as string - will be id1
 * @param {*} sortkey sort key as string - will be id2
 * @param {*} indexSort secondary index sortkey - will be datetime
 */
var initFriendTable = function (tableName, hashkey, sortkey, indexSort) {
    db.listTables(function (err, data) {
        if (err) {
            console.log(err);
        } else {
            console.log("Connected to AWS DynamoDB");

            var tables = data.TableNames.toString().split(",");
            console.log("Tables in DynamoDB: " + tables);

            if (tables.indexOf(tableName) == -1) {
                console.log("Creating new table '" + tableName + "'");

                var params = {
                    AttributeDefinitions:
                        [
                            {
                                AttributeName: hashkey,
                                AttributeType: 'S'
                            },
                            {
                                AttributeName: sortkey,
                                AttributeType: 'S'
                            },
                            {
                                AttributeName: indexSort,
                                AttributeType: 'S'
                            }
                        ],
                    KeySchema:
                        [
                            {
                                AttributeName: hashkey,
                                KeyType: 'HASH'
                            },
                            {
                                AttributeName: sortkey,
                                KeyType: 'RANGE'
                            }
                        ],
                    GlobalSecondaryIndexes: [
                        {
                            IndexName: sortkey + '-index',
                            KeySchema:
                                [
                                    {
                                        AttributeName: sortkey,
                                        KeyType: 'HASH'
                                    }
                                ],
                            Projection: {
                                ProjectionType: "ALL"
                            },
                            ProvisionedThroughput: {
                                ReadCapacityUnits: 3,       // DANGER: Don't increase this too much; stay within the free tier!
                                WriteCapacityUnits: 3       // DANGER: Don't increase this too much; stay within the free tier!
                            }
                        },
                        {
                            IndexName: hashkey + '-index-sorted',
                            KeySchema:
                                [
                                    {
                                        AttributeName: hashkey,
                                        KeyType: 'HASH'
                                    },
                                    {
                                        AttributeName: indexSort,
                                        KeyType: 'RANGE'
                                    }
                                ],
                            Projection: {
                                ProjectionType: "ALL"
                            },
                            ProvisionedThroughput: {
                                ReadCapacityUnits: 3,       // DANGER: Don't increase this too much; stay within the free tier!
                                WriteCapacityUnits: 3       // DANGER: Don't increase this too much; stay within the free tier!
                            }
                        },
                        {
                            IndexName: sortkey + '-index-sorted',
                            KeySchema:
                                [
                                    {
                                        AttributeName: sortkey,
                                        KeyType: 'HASH'
                                    },
                                    {
                                        AttributeName: indexSort,
                                        KeyType: 'RANGE'
                                    }
                                ],
                            Projection: {
                                ProjectionType: "ALL"
                            },
                            ProvisionedThroughput: {
                                ReadCapacityUnits: 3,       // DANGER: Don't increase this too much; stay within the free tier!
                                WriteCapacityUnits: 3       // DANGER: Don't increase this too much; stay within the free tier!
                            }
                        }
                    ],
                    ProvisionedThroughput: {
                        ReadCapacityUnits: 3,       // DANGER: Don't increase this too much; stay within the free tier!
                        WriteCapacityUnits: 3       // DANGER: Don't increase this too much; stay within the free tier!
                    },
                    TableName: tableName /* required */
                };

                db.createTable(params, function (err, data) {
                    if (err) {
                        console.log(err)
                    }
                    else {
                        console.log("Table is being created; waiting for 20 seconds...");
                        setTimeout(function () {
                            console.log("Success");
                        }, 20000);
                    }
                });
            } else {
                console.log("Table " + tableName + " already exists");
            }
        }
    });
}

/**
 * Init a table that has a primary AND secondary key
 * @param {*} tableName 
 * @param {*} hashkey hashkey column name as string
 * @param {*} index secondary index column name as string
 */
var initChatMembershipTable = function (tableName, hashkey, sortkey, dateKey) {
    db.listTables(function (err, data) {
        if (err) {
            console.log(err, err.stack);
        } else {
            console.log("Connected to AWS DynamoDB");

            var tables = data.TableNames.toString().split(",");
            console.log("Tables in DynamoDB: " + tables);
            if (tables.indexOf(tableName) == -1) {
                console.log("Creating new table '" + tableName + "'");

                var params = {
                    AttributeDefinitions:
                        [
                            {
                                AttributeName: hashkey,
                                AttributeType: 'S'
                            },
                            {
                                AttributeName: sortkey,
                                AttributeType: 'S'
                            },
                            {
                                AttributeName: dateKey,
                                AttributeType: 'S'
                            }
                        ],
                    KeySchema:
                        [
                            {
                                AttributeName: hashkey,
                                KeyType: 'HASH'
                            },
                            {
                                AttributeName: sortkey,
                                KeyType: 'RANGE'
                            }
                        ],
                    GlobalSecondaryIndexes: [
                        {
                            IndexName: hashkey + '-index',
                            KeySchema:
                                [
                                    {
                                        AttributeName: hashkey,
                                        KeyType: 'HASH'
                                    },
                                    {
                                        AttributeName: dateKey,
                                        KeyType: 'RANGE'
                                    }
                                ],
                            Projection: {
                                ProjectionType: "ALL"
                            },
                            ProvisionedThroughput: {
                                ReadCapacityUnits: 3,       // DANGER: Don't increase this too much; stay within the free tier!
                                WriteCapacityUnits: 3       // DANGER: Don't increase this too much; stay within the free tier!
                            }
                        },
                        {
                            IndexName: sortkey + '-index',
                            KeySchema:
                                [
                                    {
                                        AttributeName: sortkey,
                                        KeyType: 'HASH'
                                    }
                                ],
                            Projection: {
                                ProjectionType: "ALL"
                            },
                            ProvisionedThroughput: {
                                ReadCapacityUnits: 3,       // DANGER: Don't increase this too much; stay within the free tier!
                                WriteCapacityUnits: 3       // DANGER: Don't increase this too much; stay within the free tier!
                            }
                        }
                    ],
                    ProvisionedThroughput: {
                        ReadCapacityUnits: 3,       // DANGER: Don't increase this too much; stay within the free tier!
                        WriteCapacityUnits: 3       // DANGER: Don't increase this too much; stay within the free tier!
                    },
                    TableName: tableName /* required */
                };

                db.createTable(params, function (err, data) {
                    if (err) {
                        console.log(err)
                    }
                    else {
                        console.log("Table is being created; waiting for 20 seconds...");
                        setTimeout(function () {
                            console.log("Success");
                        }, 20000);
                    }
                });
            } else {
                console.log("Table " + tableName + " already exists");
            }
        }
    });
}

/**
 * Init a table that has a primary AND secondary key AND sort
 * @param {*} tableName 
 * @param {*} hashkey hashkey column name as string
 * @param {*} sortkey sort key as string
 * @param {*} index secondary index column name as string
 */
var initChatsTable = function (tableName, hashkey, index, sortkey) {
    db.listTables(function (err, data) {
        if (err) {
            console.log(err, err.stack);
        } else {
            console.log("Connected to AWS DynamoDB");

            var tables = data.TableNames.toString().split(",");
            console.log("Tables in DynamoDB: " + tables);
            if (tables.indexOf(tableName) == -1) {
                console.log("Creating new table '" + tableName + "'");

                var params = {
                    AttributeDefinitions:
                        [
                            {
                                AttributeName: hashkey,
                                AttributeType: 'S'
                            },
                            {
                                AttributeName: sortkey,
                                AttributeType: 'S'
                            },
                            {
                                AttributeName: index,
                                AttributeType: 'S'
                            }
                        ],
                    KeySchema:
                        [
                            {
                                AttributeName: hashkey,
                                KeyType: 'HASH'
                            }
                        ],
                    GlobalSecondaryIndexes: [
                        {
                            IndexName: 'userId' + '-index',
                            KeySchema:
                                [
                                    {
                                        AttributeName: index,
                                        KeyType: 'HASH'
                                    },
                                    {
                                        AttributeName: sortkey,
                                        KeyType: 'RANGE'
                                    }
                                ],
                            Projection: {
                                ProjectionType: "ALL"
                            },
                            ProvisionedThroughput: {
                                ReadCapacityUnits: 3,       // DANGER: Don't increase this too much; stay within the free tier!
                                WriteCapacityUnits: 3       // DANGER: Don't increase this too much; stay within the free tier!
                            }
                        }
                    ],
                    ProvisionedThroughput: {
                        ReadCapacityUnits: 3,       // DANGER: Don't increase this too much; stay within the free tier!
                        WriteCapacityUnits: 3       // DANGER: Don't increase this too much; stay within the free tier!
                    },
                    TableName: tableName /* required */
                };

                db.createTable(params, function (err, data) {
                    if (err) {
                        console.log(err)
                    }
                    else {
                        console.log("Table is being created; waiting for 20 seconds...");
                        setTimeout(function () {
                            console.log("Success");
                        }, 20000);
                    }
                });
            } else {
                console.log("Table " + tableName + " already exists");
            }
        }
    });
}

initThreeKeyTable('users', 'id', 'username', 'email','verfied');
initFriendTable('friends', 'id1', 'id2', 'datetime', false);
initTwoKeyTableWithKeySort('posts', 'id', 'wallId', 'datetime'); // dynamodb uses date string
initTableWithSort('comments', 'postId', 'datetime');
initTableWithSort('news-recommendations-weights', 'link', 'userId');
initChatsTable('chats', 'id', 'userId1', 'userId2');
initChatMembershipTable('chat-memberships', 'userId', 'chatId', 'datetime');
initTableWithSort('messages', 'chatId', 'datetime');
initTableWithSort('news-recommendations', 'userId', 'link');
initTable('news-recommendations-info', 'link');