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
		
		int count1 = 0;
	//stores all columns using look up function	
		   String url = lookup(csvRow, columnNames, "link");
		   String inxid = lookup(csvRow, columnNames, "short_description");
		   String headline = lookup(csvRow, columnNames, "headline");
		   String date = lookup(csvRow, columnNames, "date");


	   
	   String[] articleCat = model.tokenize(lookup(csvRow, columnNames, "category"));
	   String[] articleHeadline = model.tokenize(lookup(csvRow, columnNames, "headline"));
	   String[] articleAuthor = model.tokenize(lookup(csvRow, columnNames, "authors"));
	   String[] articleDescrip = model.tokenize(lookup(csvRow, columnNames, "short_description"));
	   String[] articleDate = model.tokenize(lookup(csvRow, columnNames, "date"));
	   
	   
	   String[][] columns = {articleCat,articleHeadline,articleAuthor,articleDescrip,articleDate};
	   
	   //array list of words we will eventually add
	   ArrayList<String> words = new ArrayList<String>(0);
		
	   for(int i = 0; i < columns.length; i++) {
		  
		   // array we are currently cleaning
		   String[] currArr = columns[i];
		   
		   for(int j = 0; j < currArr.length; j++) {
			   if(isWordCheck(currArr[j])) {
				   String str = currArr[j].toLowerCase(); //converts word to lowercase 
				   PorterStemmer stem= new PorterStemmer(); //stems word
				  // System.out.println("A: " + str);
				   str = stem.stem(str);
				   //System.out.println("B: " + str);
				 
				   if(checkStopWordsAll(str) && !words.contains(str)) {
					   count1++;
					   words.add(str); //if passes all cleaning checks, add to main, cleaned, words arraylist
					}
			   }
		   }
	   }
	   
	            //batch write  
	            TableWriteItems forumTableWriteItems = new TableWriteItems("inverted");
	            int count = 1;  	
    	    	ArrayList<Item> toAdd = new ArrayList<Item>();	            
	    	    for(int i = 0; i < words.size(); i++) {  
	    	    	
		    	    	  int strYear;
						  int strMonth;
						  int strDay;
					   
						   date = date.replaceFirst("2018", "2022");
						   date = date.replaceFirst("2017", "2021");
						   date =  date.replaceFirst("2016", "2020");
						   date =  date.replaceFirst("2015", "2019");
						   date =  date.replaceFirst("2014", "2018");
						   date =  date.replaceFirst("2013", "2017");
						   date =  date.replaceFirst("2012", "2016");

						   
						   strYear = Integer.parseInt(date.substring(0,4));
						   strMonth = Integer.parseInt(date.substring(5,7));
						   strDay = Integer.parseInt(date.substring(8,10));

						   if(strYear == 202) {						   
							   strYear = 2020;
						   }
						   
						   // only adds data before 2020-12-14
						   if( (strYear > 2020) ) {
							   continue;
						   } else if ( (strYear == 2020) && (strMonth > 12)) {
							   continue;
						   } else if ( (strYear == 2020) && (strMonth == 12) &&  (strDay > 14)) {
							   continue;
						   } else {
								toAdd.add(new Item()
				    	     			.withPrimaryKey("keyword", words.get(i),"short_description", inxid) 
				    	            	.withString("url",url)
			          	            	.withString("headline",headline)
			          	            	.withString("date",date));							   
						   }
						   
				

	    	    	
	    	        forumTableWriteItems.withItemsToPut( toAdd);
	    	            count++;	    	      
	    	        	if(count == 25 || (i +1) == words.size()) { //by using the or statement, I avoid having to use the unprocessedItems command
	    	        		forumTableWriteItems.withItemsToPut( toAdd);
			        	   BatchWriteItemOutcome outcome = db.batchWriteItem(forumTableWriteItems);	
			        	   outcome.getUnprocessedItems();
			        	   while(outcome.getUnprocessedItems().size() > 0) {
			        		   db.batchWriteItemUnprocessed(outcome.getUnprocessedItems());
			        	   }
			    	       toAdd = new ArrayList<Item>();
			        	   count = 1;
	    	            }
	    	        		    	      
	    	    }	    
	}
	
		  
	
	
	//helper function for checking if word only contains letters of Latin alphabet
	private boolean isWordCheck(String s) {
		return ((s != null) 
                && (!s.equals("")) 
                && (s.matches("^[a-zA-Z]*$"))); 
	}

	
	private boolean checkStopWordsAll(String s) {
		
		
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
					new KeySchemaElement("url", KeyType.RANGE)), // Sort key
					Arrays.asList(new AttributeDefinition("keyword", ScalarAttributeType.S),
							new AttributeDefinition("url", ScalarAttributeType.S)),
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
