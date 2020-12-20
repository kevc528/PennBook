# PennBook
Facebook inspired social media app for Penn students

## Source Files:

Main Functionality:
- app.js
- scripts/create_tables.js    (sets up DynamoDB tables/indices)
- routes/                     (All routes accessed by app.js)
- models/                     (Database interactions accessed by routes)
- views/                      (ejs files, organized by category)
- public/css/                 (CSS for ejs files)
- public/js/                  (required JavaScript corresponding to ejs files)
- public/images/              (required images for ejs files)
- public/media/               (required media for ejs files)

Additional:
- Recommender/                (Java project for recommendations)
- config.js                   (For EMR configurations when putting Recommender to s3)
- NewsIndexer/                (Java project for news search keywords)



## Instructions for running the code:

Run these commands under the G07 directory:
install node modules
npm install

enter in your aws credentials
`vim ~/.aws/credentials`

script to create tables with correct indices
`node scripts/create_tables.js`

run the web app on localhost
`node app.js`

### Instructions for setting up recommendations:

Run `mvn package` under the Recommender directory

This will create the .jar file to upload to S3
Go to aws s3 and upload the SNAPSHOT jar file into a bucket
Go to config.js
Update the SPARK_JAR field to you s3 address for the jar file you just uploaded

Start up a EMR instance with Livy
After spinning up, copy the Livy url into the EMR_LIVY_URL WITHOUT a trailing slash

### Instructions for setting up news search:

(This is meant to be done a single time and allows the news search bar to obtain results. The following steps run LoadData.java within NewsIndexer to put keywords into an inverted-index table. For more realism, we decided to parse/tokenize every column as keywords, which makes the runtime huge, but for our purposes we do not need to put every news article to see the news search functionality.) 

Download required 'news.csv' file (emailed to you). This is a custom file parsed from the JSON file with our own Python script

Put 'news.csv' in NewsIndexer/target

In Eclipse, fill Environment credentials for LoadData with AWS credentials.

Run LoadData, which adds articles before 12/14/2020 (actually 12/14/2016) to the inverted table. You can stop this whenever you want to stop adding keywords/articles and test the news search functionality.