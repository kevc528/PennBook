// config settings
const config = {
    'EMR_LIVY_URL': 'http://ec2-xx-xxx-xxx-xx.compute-1.amazonaws.com:8998', // NO END SLASH
    'SPARK_JAR': 's3://nets212-recommend/recommender-0.0.1-SNAPSHOT.jar',
    'SPARK_RECS_MAIN_CLASS': 'edu.upenn.cis.nets212.recommender.AdsorptionRecs',
    'SPARK_FULL_MAIN_CLASS': 'edu.upenn.cis.nets212.recommender.Adsorption'
}

module.exports = config;
