package edu.upenn.cis.nets212.recommender;

import edu.upenn.cis.nets212.config.Config;

import edu.upenn.cis.nets212.storage.DynamoConnector;
import edu.upenn.cis.nets212.storage.SparkConnector;

import scala.Tuple2;

import com.amazonaws.services.dynamodbv2.document.BatchWriteItemOutcome;
import com.amazonaws.services.dynamodbv2.document.DynamoDB;
import com.amazonaws.services.dynamodbv2.document.Item;
import com.amazonaws.services.dynamodbv2.document.PutItemOutcome;
import com.amazonaws.services.dynamodbv2.document.Table;
import com.amazonaws.services.dynamodbv2.document.TableWriteItems;
import com.amazonaws.services.dynamodbv2.document.spec.PutItemSpec;
import com.amazonaws.services.dynamodbv2.model.ConditionalCheckFailedException;

import java.io.*;
import java.text.SimpleDateFormat;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

import org.apache.spark.api.java.*;
import org.apache.spark.sql.SparkSession;
import org.apache.log4j.*;

import com.google.gson.*;

public class AdsorptionRecs {
	
	static Logger logger = LogManager.getLogger(Adsorption.class);
	
	static int iMax = 15;
	static double dMax = 0.1; // Normally at 0.05, set to 0.1 for faster runtime during demo

	/**
	 * Connection to Apache Spark
	 */
	SparkSession spark;
	JavaSparkContext context;
	public static final String RECOMMENDATION_TABLE = "news-recommendations";
	public static final String INFO_TABLE = "news-recommendations-info";
	public static final String WEIGHTS_TABLE = "news-recommendations-weights";

	
	public AdsorptionRecs() {
		System.setProperty("file.encoding", "UTF-8");
	}
		
	/**
	 * Initialize the database connection and open the file
	 * 
	 * @throws IOException
	 * @throws InterruptedException 
	 */
	public void initialize() throws IOException, InterruptedException {
		spark = SparkConnector.getSparkConnection();
		context = SparkConnector.getSparkContext();
	}
	
	public void run() throws IOException, InterruptedException {
		GraphBuilder gb = new GraphBuilder(Config.FILE_PATH);
		
		// Note - can get who is user by looking at all nodes starting with u
		JavaPairRDD<String, Tuple2<String, Double>> userCategoryEdges = gb.getUserInterestEdges();
		//System.out.println("USER CATEGORY EDGES");
		//System.out.println(userCategoryEdges.collect());
		
		// articles all begin with h (http)
		JavaPairRDD<String, Tuple2<String, Iterable<String>>> articles = gb.getArticles();
		JavaPairRDD<String, Tuple2<String, Double>> categoryArticleEdges = gb.getCategoryArticleEdges(articles);
				
		JavaPairRDD<String, Tuple2<String, Double>> userUserEdges = gb.getFriendEdges();
		//System.out.println("FRIEND EDGES");
		//System.out.println(userUserEdges.collect());
		
		JavaPairRDD<String, Tuple2<String, Boolean>> pastRecommendations = gb.getPastRecommendations();
		JavaPairRDD<String, Tuple2<String, Double>> userArticleEdges = gb.getArticleLikeEdges(pastRecommendations);
		//System.out.println("USER LIKE EDGES");
		//System.out.println(userArticleEdges.collect());
		
		JavaPairRDD<String, Tuple2<String, Double>> userEdges = userCategoryEdges
				.union(userUserEdges)
				.union(userArticleEdges);
		
		// (source, (dest, weight))
		JavaPairRDD<String, Tuple2<String, Double>> edges = gb.getEdges(userCategoryEdges, categoryArticleEdges, 
				userArticleEdges, userEdges).cache();
				
		//System.out.println("=======================================================");
		//System.out.println("EDGES");
		
//		for (Tuple2<String, Tuple2<String, Double>> tuple : edges.collect()) {
//			System.out.println(tuple.toString());
//		}
		
		JavaRDD<String> users = userEdges.groupByKey()
				.map(x -> x._1);
		
		//System.out.println(users.collect());
		
		JavaPairRDD<String, Tuple2<String, Double>> nodeLabels = edges
				.keys()
				.distinct()
				.cartesian(users)
				.mapToPair(x -> new Tuple2<String, String>(x._1, x._2))
				.filter(x -> (x._1.equals(x._2) || (x._1.startsWith("SHADOW") && x._1.substring(6).equals(x._2))))
				.mapToPair(x -> new Tuple2<String, Tuple2<String, Double>> (x._1,
						new Tuple2<String, Double>(x._2, 1.0)));
		
		JavaPairRDD<String, Tuple2<String, Double>> shadowLabels = nodeLabels
				.filter(x -> x._1.startsWith("SHADOW") && x._1.substring(6).equals(x._2._1));

//		System.out.println("=======================================================");
//		System.out.println("INITIAL WEIGHTS");
//		System.out.println(nodeLabels.count());
//		for (Tuple2<String, Tuple2<String, Double>> tuple : nodeLabels.collect()) {
//			System.out.println(tuple.toString());
//		}
		
		// Begin the Adsorption Algorithm
		for (int i = 0; i < iMax; i++) {
			// ((dest, label), weight)
			JavaPairRDD<Tuple2<String, String>, Double> propogateRDD = edges
					.join(nodeLabels)
					.mapToPair(item -> new Tuple2<Tuple2<String, String>, Double>(
							new Tuple2<String, String>(item._2._1._1, item._2._2._1), item._2._1._2 * item._2._2._2)
					);
			
			// need to sum up the labels for each node - (label, (dest, sum))
			JavaPairRDD<String, Tuple2<String, Double>> sumLabelRDD = propogateRDD
					.reduceByKey((weight1, weight2) -> weight1 + weight2)
					.mapToPair(item -> new Tuple2<String, Tuple2<String, Double>>(item._1._2, new Tuple2<String, Double>(item._1._1, item._2)));
			
//			System.out.println("=======================================================");
//			for (Tuple2 tuple : sumLabelRDD.collect()) {
//				System.out.println(tuple.toString());
//			}
			
			// need to sum up entire sum for each label - (label, sum)
			JavaPairRDD<String, Double> totalLabelRDD = sumLabelRDD
					.mapToPair(item -> new Tuple2<String, Double>(item._1, item._2._2))
					.reduceByKey((weight1, weight2) -> weight1 + weight2);
			
//			System.out.println("=======================================================");
//			for (Tuple2<String, Double> tuple : totalLabelRDD.collect()) {
//				System.out.println(tuple.toString());
//			}
						
			// scale by the sum and then add 1 weight to each user
			JavaPairRDD<String, Tuple2<String, Double>> nextLabelWeights = sumLabelRDD
					.join(totalLabelRDD)
					.mapToPair(item -> new Tuple2<String, Tuple2<String, Double>> (item._2._1._1,
							new Tuple2<String, Double>(item._1, item._2._2 == 0 ? 0 : item._2._1._2 / item._2._2)))
					.union(shadowLabels);
		
			JavaPairRDD<Tuple2<String, String>, Double> joinableNextWeights = nextLabelWeights
					.mapToPair(item -> new Tuple2<Tuple2<String, String>, Double>(new Tuple2<String, String>(item._1, item._2._1), item._2._2));
			
			JavaPairRDD<Tuple2<String, String>, Double> joinablePrevWeights = nodeLabels
					.mapToPair(item -> new Tuple2<Tuple2<String, String>, Double>(new Tuple2<String, String>(item._1, item._2._1), item._2._2));
			
			double maxWeightDiff = joinablePrevWeights.fullOuterJoin(joinableNextWeights)
					.map(item -> Math.abs(item._2._1.orElse(0.0) - item._2._2.orElse(0.0)))
					.max(Comparator.naturalOrder());
			
			nodeLabels = nextLabelWeights;
			
//			System.out.println("=======================================================");
//			for (Object tuple : nextLabelWeights.collect()) {
//				System.out.println(tuple.toString());
//			};

			if (maxWeightDiff <= dMax) {
				break;
			}
		}
		
		// need the Integer to be a pair RDD - these are filtered past articles used to eliminate future non-yesterday
		JavaPairRDD<String, Integer> yesterdayArticles = articles
				.filter(item -> {
	    			SimpleDateFormat format = new SimpleDateFormat("yyyy-MM-dd");
	    			Date date = format.parse(item._2._2.iterator().next());
	    			
	    			Calendar c = Calendar.getInstance();
	    			c.setTime(new Date());
	    			c.add(Calendar.DATE, -1);
	    			Date yesterday = c.getTime();
	    				    			
	    			return yesterday.getTime() < date.getTime();
				})
				.mapToPair(item -> new Tuple2<String, Integer>(item._1, 0));
        		
		JavaPairRDD<String, Tuple2<String, Double>> recommendationWeights = nodeLabels
				.filter(item -> item._1.startsWith("h") && item._2._1.startsWith("u") && item._2._2 > 0)
				.join(yesterdayArticles)
				.mapToPair(item -> new Tuple2<String, Tuple2<String, Double>>(item._1, new Tuple2<String, Double>(item._2._1._1, item._2._1._2)));
		
		JavaPairRDD<Tuple2<String, String>, Boolean> joinablePastRecs = pastRecommendations
				.mapToPair(item -> new Tuple2<Tuple2<String, String>, Boolean>(new Tuple2<String, String>(item._1, item._2._1), item._2._2));
		
		JavaPairRDD<Tuple2<String, String>, Double> joinableCurrRecs = recommendationWeights
				.mapToPair(item -> new Tuple2<Tuple2<String, String>, Double>(new Tuple2<String, String>(item._2._1, item._1), item._2._2));	
		
		JavaPairRDD<String, Tuple2<String, Double>> newRecs = joinableCurrRecs.leftOuterJoin(joinablePastRecs)
				.filter(item -> !item._2._2.isPresent())
				.mapToPair(item -> new Tuple2<String, Tuple2<String, Double>>(item._1._1, new Tuple2<String, Double>(item._1._2, item._2._1)));
		
		JavaPairRDD<String, Double> userTotalWeights = newRecs
				.mapToPair(item -> new Tuple2<String, Double>(item._1, item._2._2))
				.reduceByKey((weight1, weight2) -> weight1 + weight2);
		
		newRecs = newRecs.join(userTotalWeights)
				.mapToPair(item -> new Tuple2<String, Tuple2<String, Double>>(item._1,
						new Tuple2<String, Double>(item._2._1._1, item._2._1._2 / item._2._2)));
		
		JavaPairRDD<String, String> finalRecs = newRecs.groupByKey()
				.flatMapToPair(item -> {
					// weighted random sampling
					List<Tuple2<String, String>> sampled = new ArrayList<Tuple2<String, String>>();
					
					Iterator<Tuple2<String, Double>> iterator1 = item._2.iterator();
					double random1 = Math.random();
					double prev1 = 0.0;
					
					Tuple2<String, Double> next = null;
					
					while (iterator1.hasNext()) {
						next = iterator1.next();
						if (next._2 + prev1 > random1) {
							sampled.add(new Tuple2<String, String>(item._1, next._1));
							break;
						}
						prev1 += next._2;
					}
					
					// don't run the second sample if there was nothing to sample the first time
					if (next == null) {
						return sampled.iterator();
					}
					
					double random2 = Math.random() * (1 - next._2);
					Iterator<Tuple2<String, Double>> iterator2 = item._2.iterator();
					double prev2 = 0.0;
					
					while (iterator2.hasNext()) {
						next = iterator2.next();
						// make sure we don't suggest same article
						if (next._1.equals(sampled.get(0)._2)) {
							continue;
						}
						if (next._2 + prev2 > random2) {
							sampled.add(new Tuple2<String, String>(item._1, next._1));
							break;
						}
						prev2 += next._2;
					}
					
					return sampled.iterator();
				});
		
//		System.out.println("=======================================================");
//		for (Object tuple : finalRecs.collect()) {
//			System.out.println(tuple.toString());
//		};
		
		// Add the new articles to "news-likes" table with 0 likes
        JavaPairRDD<String, String> finalRecsInvert = finalRecs.mapToPair(pair -> new Tuple2<String, String>(pair._2, pair._1));
        //JavaPairRDD<String, Tuple2<String, Iterable<String>>> nonArticles = articles.subtractByKey(finalRecsInvert);
        //articles = articles.subtractByKey(nonArticles);
        
        JavaPairRDD<String, Tuple2<String, Tuple2<String, Iterable<String>>>> finalRecsArticles = finalRecsInvert.join(articles);

        finalRecsArticles.foreachPartition(partition -> {
			DynamoDB db = DynamoConnector.getConnection(Config.DYNAMODB_URL);
            String date = ZonedDateTime.now(ZoneOffset.UTC).format(DateTimeFormatter.ISO_INSTANT);
            Table newsTable = db.getTable(INFO_TABLE);
            
            List<Item> recsToAdd = new ArrayList<Item>();
            List<Item> postsToAdd = new ArrayList<Item>();
            
            while (partition.hasNext()) {
                Tuple2<String,Tuple2<String,Tuple2<String,Iterable<String>>>> item = partition.next();
            	String userId = item._2._1.substring(1);
            	
	            if (recsToAdd.size() >= 25) {
	            	TableWriteItems writeRecItems = new TableWriteItems(RECOMMENDATION_TABLE).withItemsToPut(recsToAdd);
	            	BatchWriteItemOutcome outcome = db.batchWriteItem(writeRecItems);
	                if (outcome.getUnprocessedItems().size() > 0) {
	                    db.batchWriteItemUnprocessed(outcome.getUnprocessedItems());
	                }
	                recsToAdd = new ArrayList<Item>();
	            }
	            
	            if (postsToAdd.size() >= 25) {
	            	TableWriteItems writePostItems = new TableWriteItems("posts").withItemsToPut(postsToAdd);
	            	BatchWriteItemOutcome outcome = db.batchWriteItem(writePostItems);
	                if (outcome.getUnprocessedItems().size() > 0) {
	                    db.batchWriteItemUnprocessed(outcome.getUnprocessedItems());
	                }
	                postsToAdd = new ArrayList<Item>();
	            }
            	
                Item rec = new Item()
                		.withPrimaryKey("userId", userId)
                		.withString("link", item._1)
                		.withString("datetime", date)
                		.withBoolean("liked", false);
                recsToAdd.add(rec);
                
                Item recPost = new Item()
                        .withPrimaryKey("id", UUID.randomUUID().toString())
                        .withString("authorId", userId)
                        .withString("wallId", userId)
                        .withString("content", item._1)
                        .withString("contentType", "news")
                        .withString("datetime", date)
                        .withBoolean("liked", false);
                postsToAdd.add(recPost);
                
                Iterator<String> iter = item._2._2._2.iterator();
                String link = item._1;
                String category = item._2._2._1;
                String newsDate = iter.next();
                String title = iter.next();
                String author = iter.next();
                String description = iter.next();
                Item news = new Item()
                        .withPrimaryKey("link", link)
                        .withString("category", category)
                        .withString("date", newsDate)
                        .withString("headline", title)
                        .withString("author", author)
                        .withString("description", description)
                        .withInt("likes", 0);
          
                try {
                    PutItemSpec putItemSpec = new PutItemSpec().withItem(news).withConditionExpression("attribute_not_exists(link)");
                    PutItemOutcome newsOutcome = newsTable.putItem(putItemSpec);
                } catch(ConditionalCheckFailedException ex) {
                     System.out.println("News already exists in Dynamo DB Table ");
                }
            }
            
            if (recsToAdd.size() > 0) {
            	TableWriteItems writeRecItems = new TableWriteItems(RECOMMENDATION_TABLE).withItemsToPut(recsToAdd);
            	BatchWriteItemOutcome outcome = db.batchWriteItem(writeRecItems);
                if (outcome.getUnprocessedItems().size() > 0) {
                    db.batchWriteItemUnprocessed(outcome.getUnprocessedItems());
                }
            }
            
            if (postsToAdd.size() > 0) {
            	TableWriteItems writePostItems = new TableWriteItems("posts").withItemsToPut(postsToAdd);
            	BatchWriteItemOutcome outcome = db.batchWriteItem(writePostItems);
                if (outcome.getUnprocessedItems().size() > 0) {
                    db.batchWriteItemUnprocessed(outcome.getUnprocessedItems());
                }
            }
            
		});
		
	}
	
	public void shutdown() {				
		if (spark != null)
			spark.close();
	}
	
    public static void main( String[] args )
    {
//    	final long startTime = System.currentTimeMillis();
		final AdsorptionRecs ad = new AdsorptionRecs();

		try {
			logger.info("HERE");
			ad.initialize();
			ad.run();
		} catch (final IOException ie) {
			ie.printStackTrace();
		} catch (final InterruptedException e) {
			e.printStackTrace();
		} finally {
			ad.shutdown();
		}
		
//		final long endTime = System.currentTimeMillis();
//		System.out.println("TOTAL TIME: " + (endTime - startTime));
	}
}
