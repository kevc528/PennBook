package edu.upenn.cis.nets212.recommender;

import java.io.*;
import java.text.SimpleDateFormat;
import java.util.*;
import java.util.Iterator;

import org.apache.spark.api.java.*;
import org.apache.spark.sql.SparkSession;
import org.apache.log4j.*;
import org.apache.hadoop.dynamodb.DynamoDBItemWritable;
import org.apache.hadoop.dynamodb.read.DynamoDBInputFormat;
import org.apache.hadoop.dynamodb.write.DynamoDBOutputFormat;
import org.apache.hadoop.io.Text;
import org.apache.hadoop.mapred.JobConf;
import com.google.gson.*;

import edu.upenn.cis.nets212.config.Config;
import edu.upenn.cis.nets212.storage.*;
import scala.Tuple2;

import com.amazonaws.services.dynamodbv2.*;
import com.amazonaws.services.dynamodbv2.document.Item;
import com.amazonaws.services.dynamodbv2.document.ItemCollection;
import com.amazonaws.services.dynamodbv2.document.ScanOutcome;
import com.clearspring.analytics.util.Pair; 

public class GraphBuilder {

	String filePath;
	SparkSession spark;
	JavaSparkContext context;
	
	public GraphBuilder(String filePath) {
		this.filePath = filePath;
		this.spark = SparkConnector.getSparkConnection();
		this.context = SparkConnector.getSparkContext();
	}
	
	public JavaPairRDD<String, Tuple2<String, Double>> getUserInterestEdges() {
		
		DynamoLoader loader = DynamoLoader.getInstance();
				
		Iterator<Item> userIterator = loader.getData("users").iterator();
		List<String> userInterestsList = new LinkedList<String>();
		
		while (userIterator.hasNext()) {
			Item user = userIterator.next();
			String userEncoding = "u" + user.getString("id"); // add u before all users to identify
			for (Object interest : user.getList("interests")) {
				userEncoding += "_i" + interest.toString(); // add i before all intersets
			}
			userInterestsList.add(userEncoding);
		}
		
		JavaRDD<String> userInterestRDD = context.parallelize(userInterestsList);
		JavaPairRDD<String, String> edges = userInterestRDD
				.flatMapToPair(s -> {
					List<Tuple2<String, String>> ans = new ArrayList<Tuple2<String, String>>();
					String[] splitted = s.split("_");
					String user = splitted[0];
					for (int i = 1; i < splitted.length; i++) {
						ans.add(new Tuple2<String, String>(user, splitted[i].toUpperCase()));
					}
					return ans.iterator();
				});

		JavaPairRDD<String, Double> userWeights = edges.mapToPair(edge -> new Tuple2<String, Double>(edge._1, 1.0))
				.reduceByKey((count1, count2) -> count1 + count2)
				.mapToPair(item -> new Tuple2<String, Double>(item._1, 0.3 / item._2));
		
		JavaPairRDD<String, Tuple2<String, Double>> userWeightedEdges = edges.join(userWeights);
		
		return userWeightedEdges;
	}
	
	public JavaPairRDD<String, Tuple2<String, Iterable<String>>> getArticles() {
		
		JavaPairRDD<String, Tuple2<String, Iterable<String>>> articles = context.textFile(this.filePath, Config.PARTITIONS)
				.filter(line -> {
	    			JsonParser parser = new JsonParser();
	    			JsonObject object = parser.parse(line).getAsJsonObject();
	    			
	    			SimpleDateFormat format = new SimpleDateFormat("yyyy-MM-dd");
	    			Date date = format.parse(object.get("date").getAsString());
	    			Calendar c = Calendar.getInstance();
	    			c.setTime(date);
	    			c.add(Calendar.YEAR, 4);
	    			date = c.getTime();
	    			
	    			return date.getTime() < new Date().getTime();
				})
	    		.mapToPair(line -> {
	    			JsonParser parser = new JsonParser();
	    			JsonObject object = parser.parse(line).getAsJsonObject();
	    			
	    			SimpleDateFormat format = new SimpleDateFormat("yyyy-MM-dd");
	    			Date date = format.parse(object.get("date").getAsString());
	    			Calendar c = Calendar.getInstance();
	    			c.setTime(date);
	    			c.add(Calendar.YEAR, 4);
	    			date = c.getTime();
	    			String dateString = format.format(date);
	    			
	    			return new Tuple2<String, Tuple2<String, Iterable<String>>>(object.get("link").getAsString(),
	    					new Tuple2<String, Iterable<String>>(object.get("category").getAsString(), 
	    							Arrays.asList(
	    		    						new String[] {dateString, object.get("headline").getAsString(), object.get("authors").getAsString(), 
	    		    								object.get("short_description").getAsString()}
	    		    					) 
	    							));
	    		});
		return articles;
	}
	
	
public JavaPairRDD<String, Tuple2<String, Iterable<String>>> getAllArticles() {
        
        JavaPairRDD<String, Tuple2<String, Iterable<String>>> articles = context.textFile(this.filePath, Config.PARTITIONS)
                .mapToPair(line -> {
                    JsonParser parser = new JsonParser();
                    JsonObject object = parser.parse(line).getAsJsonObject();
                    
                    SimpleDateFormat format = new SimpleDateFormat("yyyy-MM-dd");
                    Date date = format.parse(object.get("date").getAsString());
                    Calendar c = Calendar.getInstance();
                    c.setTime(date);
                    c.add(Calendar.YEAR, 4);
                    date = c.getTime();
                    String dateString = format.format(date);
                    
                    return new Tuple2<String, Tuple2<String, Iterable<String>>>(object.get("link").getAsString(),
                            new Tuple2<String, Iterable<String>>(object.get("category").getAsString(), 
                                    Arrays.asList(
                                            new String[] {dateString, object.get("headline").getAsString(), object.get("authors").getAsString(), 
                                                    object.get("short_description").getAsString()}
                                        ) 
                                    ));
                });
        return articles;
    }
	
	public JavaPairRDD<String, Tuple2<String, Double>> getCategoryArticleEdges(JavaPairRDD<String, Tuple2<String, Iterable<String>>> articles) {
		
		JavaPairRDD<String, Tuple2<String, Double>> categoryArticle = articles
				.mapToPair(row -> new Tuple2<String, Tuple2<String, Double>>(("i" + row._2._1).toUpperCase(), new Tuple2<String, Double>(row._1, 1.0)));
		
		JavaPairRDD<String, Double> categoryWeights = categoryArticle.mapToPair(edge -> new Tuple2<String, Double>(edge._1, 1.0))
				.reduceByKey((count1, count2) -> count1 + count2)
				.mapToPair(item -> new Tuple2<String, Double>(item._1, 1.0 / item._2));
		
		JavaPairRDD<String, String> edges = categoryArticle.mapToPair(pair -> new Tuple2<String, String>(pair._1, pair._2._1));
		
		JavaPairRDD<String, Tuple2<String, Double>> articleWeightedEdges = edges.join(categoryWeights);
				
		return articleWeightedEdges;
	}
	
	// take user->interest and article->integerst edges and flip/scale them
	private JavaPairRDD<String, Tuple2<String, Double>> getInterestOutgoingEdges(JavaPairRDD<String, Tuple2<String, Double>> userInterestEdges,
			JavaPairRDD<String, Tuple2<String, Double>> categoryArticleWeightedEdges) {
		
		JavaPairRDD<String, String> interestOutgoingEdges = userInterestEdges
				.mapToPair(edge -> new Tuple2<String, String>(edge._2._1, edge._1));
		JavaPairRDD<String, String> categoryArticleEdges = categoryArticleWeightedEdges
				.mapToPair(edge -> new Tuple2<String, String>(edge._1, edge._2._1));
		
		interestOutgoingEdges = interestOutgoingEdges.union(categoryArticleEdges);
				
		JavaPairRDD<String, Double> interestWeights = interestOutgoingEdges.mapToPair(edge -> new Tuple2<String, Double>(edge._1, 1.0))
				.reduceByKey((count1, count2) -> count1 + count2)
				.mapToPair(item -> new Tuple2<String, Double>(item._1, 1.0 / item._2));
				
		JavaPairRDD<String, Tuple2<String, Double>> interestWeightedEdges = interestOutgoingEdges.join(interestWeights);
		
		//System.out.println(interestWeightedEdges.collect());
		
		//System.out.println("CATEGORY OUTGOING EDGES");
		//System.out.println(interestWeightedEdges.collect());
				
		return interestWeightedEdges;
	}
	
	public JavaPairRDD<String, Tuple2<String, Double>> getFriendEdges() {
		DynamoLoader loader = DynamoLoader.getInstance();
				
		Iterator<Item> friendsIterator = loader.getData("friends").iterator();
		List<Tuple2<String, String>> friendsList = new LinkedList<Tuple2<String, String>>();
		
		while (friendsIterator.hasNext()) {
			Item friendship = friendsIterator.next();
			if (!friendship.getBoolean("accepted")) {
				continue;
			}
			friendsList.add(new Tuple2<String, String>("u" + friendship.getString("id1"), "u" + friendship.getString("id2")));
		}
				
		JavaPairRDD<String, String> friendPairRDD = context.parallelizePairs(friendsList);
		JavaPairRDD<String, String> friendReversed = friendPairRDD
				.mapToPair(friendship -> new Tuple2<String, String>(friendship._2, friendship._1));
		friendPairRDD = friendPairRDD.union(friendReversed);
		
		JavaPairRDD<String, Double> friendWeights = friendPairRDD.mapToPair(edge -> new Tuple2<String, Double>(edge._1, 1.0))
				.reduceByKey((count1, count2) -> count1 + count2)
				.mapToPair(item -> new Tuple2<String, Double>(item._1, 0.3 / item._2));
		
		JavaPairRDD<String, Tuple2<String, Double>> friendWeightedEdges = friendPairRDD.join(friendWeights);
				
		return friendWeightedEdges;
	}
	
	public JavaPairRDD<String, Tuple2<String, Boolean>> getPastRecommendations() {
		DynamoLoader loader = DynamoLoader.getInstance();
		
		Iterator<Item> recIterator = loader.getData("news-recommendations").iterator();
		List<Tuple2<String, Tuple2<String, Boolean>>> recList = new LinkedList<Tuple2<String, Tuple2<String, Boolean>>>();
		
		while (recIterator.hasNext()) {
			Item rec = recIterator.next();
			recList.add(new Tuple2<String, Tuple2<String, Boolean>>("u" + rec.getString("userId"), 
					new Tuple2<String, Boolean>(rec.getString("link"), rec.getBoolean("liked"))));
		}
		
		JavaPairRDD<String, Tuple2<String, Boolean>> recRDD = context.parallelizePairs(recList);
				
		return recRDD;
	}
	
	public JavaPairRDD<String, Tuple2<String, Double>> getArticleLikeEdges(JavaPairRDD<String, Tuple2<String, Boolean>> pastRecommendations) {
		
		JavaPairRDD<String, String> likedRecommendations = pastRecommendations
				.filter(recommendation -> recommendation._2._2)
				.mapToPair(recommendation -> new Tuple2<String, String>(recommendation._1, recommendation._2._1));
				
		JavaPairRDD<String, Double> userWeights = likedRecommendations
				.mapToPair(edge -> new Tuple2<String, Double>(edge._1, 1.0))
				.reduceByKey((count1, count2) -> count1 + count2)
				.mapToPair(item -> new Tuple2<String, Double>(item._1, 0.4 / item._2));
		
		JavaPairRDD<String, Tuple2<String, Double>> recWeightedEdges = likedRecommendations.join(userWeights);
		
		return recWeightedEdges;
	}
	
	// take user->article and article->interest edges and flip/scale them
	JavaPairRDD<String, Tuple2<String, Double>> getArticleOutgoingEdges(JavaPairRDD<String, Tuple2<String, Double>> userArticleEdges,
			JavaPairRDD<String, Tuple2<String, Double>> categoryArticleWeightedEdges) {
		
		JavaPairRDD<String, String> articleOutgoingEdges = userArticleEdges
				.mapToPair(edge -> new Tuple2<String, String>(edge._2._1, edge._1));
		JavaPairRDD<String, String> categoryArticleEdges = categoryArticleWeightedEdges
				.mapToPair(edge -> new Tuple2<String, String>(edge._2._1, edge._1));
		
		articleOutgoingEdges = articleOutgoingEdges.union(categoryArticleEdges);
		
		JavaPairRDD<String, Double> articleWeights = articleOutgoingEdges.mapToPair(edge -> new Tuple2<String, Double>(edge._1, 1.0))
				.reduceByKey((count1, count2) -> count1 + count2)
				.mapToPair(item -> new Tuple2<String, Double>(item._1, 1.0 / item._2));
		
		JavaPairRDD<String, Tuple2<String, Double>> articleWeightedEdges = articleOutgoingEdges.join(articleWeights);
		
		//System.out.println("ARTICLE OUTGOING EDGES");
		//System.out.println(articleWeightedEdges.collect());
		
		return articleWeightedEdges;
		
	}
	
	public JavaPairRDD<String, Tuple2<String, Double>> getEdges(JavaPairRDD<String, Tuple2<String, Double>> userCategoryEdges,
			JavaPairRDD<String, Tuple2<String, Double>> categoryArticleEdges,
			JavaPairRDD<String, Tuple2<String, Double>> userArticleEdges,
			JavaPairRDD<String, Tuple2<String, Double>> userEdges) {
		
		JavaPairRDD<String, Tuple2<String, Double>> userShadowEdges = userCategoryEdges
				.keys()
				.distinct()
				.mapToPair(item -> new Tuple2<String, Tuple2<String, Double>>("SHADOW" + item, new Tuple2<String, Double>(item, 1.0)));
		
		JavaPairRDD<String, Tuple2<String, Double>> interestOutgoingEdges = getInterestOutgoingEdges(userCategoryEdges, categoryArticleEdges);
		JavaPairRDD<String, Tuple2<String, Double>> articleOutgoingEdges = getArticleOutgoingEdges(userArticleEdges, categoryArticleEdges);
		
		JavaPairRDD<String, Tuple2<String, Double>> edges = userEdges
				.union(interestOutgoingEdges)
				.union(articleOutgoingEdges)
				.union(userShadowEdges);
		
		return edges;
	}
}
