package edu.upenn.cis.nets212.hw1;

import java.io.BufferedReader;
import java.io.FileReader;
import java.io.IOException;
import java.util.*;


import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

import com.amazonaws.services.dynamodbv2.AmazonDynamoDB;
import com.amazonaws.services.dynamodbv2.document.BatchWriteItemOutcome;
import com.amazonaws.services.dynamodbv2.document.DynamoDB;
import com.amazonaws.services.dynamodbv2.document.Item;
import com.amazonaws.services.dynamodbv2.document.PutItemOutcome;
import com.amazonaws.services.dynamodbv2.document.Table;
import com.amazonaws.services.dynamodbv2.document.TableWriteItems;
import com.amazonaws.services.dynamodbv2.local.shared.model.WriteRequest;
import com.amazonaws.services.dynamodbv2.model.AttributeDefinition;
import com.amazonaws.services.dynamodbv2.model.KeySchemaElement;
import com.amazonaws.services.dynamodbv2.model.KeyType;
import com.amazonaws.services.dynamodbv2.model.ProvisionedThroughput;
import com.amazonaws.services.dynamodbv2.model.ResourceInUseException;
import com.amazonaws.services.dynamodbv2.model.ScalarAttributeType;

import edu.upenn.cis.nets212.hw1.files.TedTalkParser.TalkDescriptionHandler;
import opennlp.tools.stemmer.PorterStemmer;
import opennlp.tools.stemmer.Stemmer;
import opennlp.tools.tokenize.SimpleTokenizer;
import software.amazon.awssdk.services.dynamodb.model.DynamoDbException;

/**
 * Callback handler for talk descriptions.  Parses, breaks words up, and
 * puts them into DynamoDB.
 * 
 * @author zives
 *
 */
public class IndexTedTalkInfo implements TalkDescriptionHandler {
	static Logger logger = LogManager.getLogger(TalkDescriptionHandler.class);

	int row = 0;
	final static String tableName = "inverted";

	
	SimpleTokenizer model;
	Stemmer stemmer;
	DynamoDB db;
	Table iindex;
	
	public IndexTedTalkInfo(final DynamoDB db) throws DynamoDbException, InterruptedException {
		model = SimpleTokenizer.INSTANCE;
		stemmer = new PorterStemmer();
		this.db = db;

		initializeTables();
	}

	/**
	 * Called every time a line is read from the input file. Breaks into keywords
	 * and indexes them.
	 * 
	 * @param csvRow      Row from the CSV file
	 * @param columnNames Parallel array with the names of the table's columns
	 */
	@Override
	public void accept(final String[] csvRow, final String[] columnNames) {
		// TODO implement accept() in IndexTexTalkInfo.java
		
		
	//stores all columns using look up function	
	   String url = lookup(csvRow, columnNames, "url");
	   String inxid = lookup(csvRow, columnNames, "talk_id");
	   
	   String[] titleTok = model.tokenize(lookup(csvRow, columnNames, "title"));
	   String[] speakerTok = model.tokenize(lookup(csvRow, columnNames, "speaker_1"));
	   String[] allSpeakersTok = model.tokenize(lookup(csvRow, columnNames, "all_speakers"));
	   String[] occupationsTok = model.tokenize(lookup(csvRow, columnNames, "occupations"));
	   String[] aboutSpeakersTok = model.tokenize(lookup(csvRow, columnNames, "about_speakers"));
	   String[] topicsTok = model.tokenize(lookup(csvRow, columnNames, "topics"));
	   String[] descriptionTok = model.tokenize(lookup(csvRow, columnNames, "description"));
	   String[] transcriptTok = model.tokenize(lookup(csvRow, columnNames, "transcript"));
	   String[] relatedTalksTok = model.tokenize(lookup(csvRow, columnNames, "related_talks"));
	   
	   String[][] columns = {titleTok,speakerTok,allSpeakersTok,occupationsTok,aboutSpeakersTok,topicsTok,descriptionTok
			   ,transcriptTok, relatedTalksTok};
	   
	   //array list of words we will eventually add
	   ArrayList<String> words = new ArrayList<String>(0);
		
	   for(int i = 0; i < columns.length; i++) {
		  
		   // array we are currently cleaning
		   String[] currArr = columns[i];
		   
		   for(int j = 0; j < currArr.length; j++) {
			   if(isWordCheck(currArr[j])) {
				   String str = currArr[j].toLowerCase(); //converts word to lowercase 
				   PorterStemmer stem= new PorterStemmer(); //stems word
				   str = stem.stem(str);
				   
				   if(checkStopWordsAll(str) && !words.contains(str)) {
					   words.add(str); //if passes all cleaning checks, add to main, cleaned, words arraylist
					}
			   }
		   }
	   }
	   
	            //batch write  
	            TableWriteItems forumTableWriteItems = new TableWriteItems("inverted");
	            int count = 1;  	            		
	    	    for(int i = 0; i < words.size(); i++) {  
	    	    	
	    	        forumTableWriteItems.withItemsToPut(
			     		new Item()
			     			.withPrimaryKey("keyword", words.get(i),"inxid", Integer.parseInt(inxid)) 
			            	.withString("url",url)
			            			);
	    	            count++;	    	      
	    	        	if(count == 25 || (i +1) == words.size()) { //by using the or statement, I avoid having to use the unprocessedItems command
			        	   BatchWriteItemOutcome outcome = db.batchWriteItem(forumTableWriteItems);	
			        	   count = 0;
	    	            } 
	    	    }
	}
	
		  
	
	
	//helper function for checking if word only contains letters of Latin alphabet
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
	

	private void initializeTables() throws DynamoDbException, InterruptedException {
		try {
			iindex = db.createTable(tableName, Arrays.asList(new KeySchemaElement("keyword", KeyType.HASH), // Partition
																												// key
					new KeySchemaElement("inxid", KeyType.RANGE)), // Sort key
					Arrays.asList(new AttributeDefinition("keyword", ScalarAttributeType.S),
							new AttributeDefinition("inxid", ScalarAttributeType.N)),
					new ProvisionedThroughput(100L, 100L));

			iindex.waitForActive();
		} catch (final ResourceInUseException exists) {
			iindex = db.getTable(tableName);
		}

	}

	/**
	 * Given the CSV row and the column names, return the column with a specified
	 * name
	 * 
	 * @param csvRow
	 * @param columnNames
	 * @param columnName
	 * @return
	 */
	public static String lookup(final String[] csvRow, final String[] columnNames, final String columnName) {
		final int inx = Arrays.asList(columnNames).indexOf(columnName);
		
		if (inx < 0)
			throw new RuntimeException("Out of bounds");
		
		return csvRow[inx];
	}
}
