package edu.upenn.cis.nets212.config;

/**
 * Global configuration for NETS 212 homeworks.
 * 
 * A better version of this would read a config file from the resources,
 * such as a YAML file.  But our first version is designed to be simple
 * and minimal. 
 * 
 * @author zives
 *
 */
public class Config {

	/**
	 * The path to the space-delimited social network data
	 */
	public static final String FILE_PATH = "s3a://penn-cis545-files/News_Category_Dataset_v2.json";
	
	public static final String LOCAL_FILE_PATH = "target/News_Category_Dataset_v2.json";
	
	public static final String SMALL_FILE_PATH = "target/larger.txt";
	
	public static final String SMALLER_FILE_PATH = "target/small.txt";
	
	public static String LOCAL_SPARK = "local[*]";
		
	public static final String SPARK_JAR = "target/recommender-0.0.1-SNAPSHOT.jar";
	
	public final static String DYNAMODB_URL = "https://dynamodb.us-east-1.amazonaws.com";
	/**
	 * How many RDD partitions to use?
	 */
	public static int PARTITIONS = 5;
}
