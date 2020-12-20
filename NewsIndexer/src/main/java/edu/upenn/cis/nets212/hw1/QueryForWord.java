package edu.upenn.cis.nets212.hw1;

import java.io.BufferedReader;
import java.io.FileReader;
import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Iterator;
import java.util.Set;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

import com.amazonaws.services.dynamodbv2.document.DynamoDB;
import com.amazonaws.services.dynamodbv2.document.ItemCollection;
import com.amazonaws.services.dynamodbv2.document.QueryOutcome;
import com.amazonaws.services.dynamodbv2.document.Table;
import com.amazonaws.services.dynamodbv2.document.spec.QuerySpec;
import com.amazonaws.services.dynamodbv2.document.utils.ValueMap;
import com.amazonaws.services.dynamodbv2.document.Item;


import edu.upenn.cis.nets212.config.Config;
import edu.upenn.cis.nets212.storage.DynamoConnector;
import opennlp.tools.stemmer.PorterStemmer;
import opennlp.tools.stemmer.Stemmer;
import software.amazon.awssdk.services.dynamodb.model.DynamoDbException;

public class QueryForWord {
	/**
	 * A logger is useful for writing different types of messages
	 * that can help with debugging and monitoring activity.  You create
	 * it and give it the associated class as a parameter -- so in the
	 * config file one can adjust what messages are sent for this class. 
	 */
	static Logger logger = LogManager.getLogger(QueryForWord.class);

	/**
	 * Connection to DynamoDB
	 */
	DynamoDB db;
	
	/**
	 * Inverted index
	 */
	Table iindex;
	
	Stemmer stemmer;

	/**
	 * Default loader path
	 */
	public QueryForWord() {
		stemmer = new PorterStemmer();
	}
	
	/**
	 * Initialize the database connection
	 * 
	 * @throws IOException
	 */
	public void initialize() throws IOException {
		logger.info("Connecting to DynamoDB...");
		db = DynamoConnector.getConnection(Config.DYNAMODB_URL);
		logger.debug("Connected!");
		iindex = db.getTable("inverted");
	}
	
	public Set<Set<String>> query(final String[] words) throws IOException, DynamoDbException, InterruptedException {
		 
        // cleanWords is the set for each word; finalSet is the array containing the cleanWords sets
		ArrayList<String> cleanWords = cleanQuery(words);
		Set<Set<String>> finalSet = new HashSet<Set<String>>();
		
		for(int i = 0; i < cleanWords.size(); i++) {
			String currWord = cleanWords.get(i);
			Set<String> currSet = new HashSet<String>();
						
		    HashMap<String, String> nameMap = new HashMap<String, String>();
		      nameMap.put("#kw", "keyword");
		
			HashMap<String, Object> valueMap = new HashMap<String, Object>();
	        	valueMap.put(":keyw", currWord);
				System.out.println("STEMMED: " + currWord);

			
	           QuerySpec querySpec = new QuerySpec()
	        		   .withKeyConditionExpression("#kw = :keyw").withNameMap(nameMap).withValueMap(valueMap);
	           
	           ItemCollection<QueryOutcome> items = null;
	           Iterator<Item> iterator = null;
	           Item item = null;

	           // try and catch blocks for error catching
	           try {
	               items = iindex.query(querySpec);
	               iterator = items.iterator();
	               
	               while (iterator.hasNext()) {
	                   item = iterator.next();
	                   String url = item.getString("url");
	                   currSet.add(url);
	               }
	               finalSet.add(currSet);
	           }
	           catch (Exception e) {
	               System.err.println("Unable to query.");
	               System.err.println(e.getMessage());
	           }
		}
       return finalSet;
	}
	
	private ArrayList<String> cleanQuery(String[] uncleanWords) {
		
		ArrayList<String> cleanWords = new ArrayList<String>(0);
		
		//checks if words are acceptable strings
		for(int i = 0; i < uncleanWords.length; i++) {
			System.out.println("UNSTEMMED: " +  uncleanWords[i]);

			 if(isWordCheck(uncleanWords[i])) {
				   String str = uncleanWords[i].toLowerCase();	
				   PorterStemmer stem= new PorterStemmer();
				   str = stem.stem(str);
		
				   if(checkStopWordsAll(str) && !cleanWords.contains(str)) {
					   cleanWords.add(str);
					}
			   }
		}
		return cleanWords;
	}
	
	//helper function to check if word is string using Regex
	private boolean isWordCheck(String s) {
		return ((s != null) 
                && (!s.equals("")) 
                && (s.matches("^[a-zA-Z]*$"))); 
	}
	
	//helper function for checking word is not a stop word; don't actually use this function since I did the extra credit. Leaving in for documentation
	private boolean checkStopWords(String s) {
		return (!s.equals("a") 
				&& !s.equals("all") 
				&& !s.equals("any") 
				&& !s.equals("but") 
				&& !s.equals("the") );
	}
	
	// **EXTRA CREDIT** helper function for checking word is not a stop word (uses files provided)
		private boolean checkStopWordsAll(String s) {
			
		    // uses bufferedreader to read from file
		       BufferedReader br = null;
	           // try and catch blocks for error catching
		       try{	
		           br = new BufferedReader(new FileReader("/home/nets212/git/HW1/target/classes/nlp_en_stop_words.txt"));		

		           String contentLine = br.readLine();
			   while (contentLine != null) {
				  if(contentLine.equals(s)) {
					  return false;
				  }
			      contentLine = br.readLine();		
			   			}
		       } catch (IOException ioe) {
		    	   ioe.printStackTrace();
		       } finally {
		    	   try {
		    		     if (br != null)
		    			 br.close();    			 
		    		   } 
		    		   catch (IOException ioe) 
		    	           {
		    			System.out.println("Error in closing the BufferedReader");
		    		   }

		       }
		       return true;
		}


	/**
	 * Graceful shutdown of the DynamoDB connection
	 */
	public void shutdown() {
		logger.info("Shutting down");
		DynamoConnector.shutdown();
	}

	public static void main(final String[] args) {
		final QueryForWord qw = new QueryForWord();

		try {
			qw.initialize();

			final Set<Set<String>> results = qw.query(args);
			for (Set<String> s : results) {
				System.out.println("=== Set");
				for (String url : s)
				  System.out.println(" * " + url);
			}
  		System.out.println("THIS IS WORD I SEARCHED FOR " + results.toString());
		} catch (final IOException ie) {
			logger.error("I/O error: ");
			ie.printStackTrace();
		} catch (final DynamoDbException e) {
			e.printStackTrace();
		} catch (final InterruptedException e) {
			e.printStackTrace();
		} finally {
			qw.shutdown();
		}
	}

}
