package edu.upenn.cis.nets212.storage;

import com.amazonaws.services.dynamodbv2.document.DynamoDB;
import com.amazonaws.services.dynamodbv2.document.Item;
import com.amazonaws.services.dynamodbv2.document.ItemCollection;
import com.amazonaws.services.dynamodbv2.document.QueryOutcome;
import com.amazonaws.services.dynamodbv2.document.ScanOutcome;
import com.amazonaws.services.dynamodbv2.document.Table;
import com.amazonaws.services.dynamodbv2.document.spec.QuerySpec;
import software.amazon.awssdk.services.dynamodb.model.DynamoDbException;

import edu.upenn.cis.nets212.config.Config;
import edu.upenn.cis.nets212.storage.DynamoConnector;

public class DynamoLoader {
	
	private DynamoDB db;
	
	private static final DynamoLoader INSTANCE = new DynamoLoader();
	
	private DynamoLoader() {}
	
	public static DynamoLoader getInstance() {
		if (INSTANCE.db == null) {
			INSTANCE.initialize();
		}
		return INSTANCE;
	}
	
	private void initialize() {
		this.db = DynamoConnector.getConnection(Config.DYNAMODB_URL);
	}
	
	public ItemCollection<ScanOutcome> getData(String tableName) {
		Table table = db.getTable(tableName);
		return table.scan();
	}
	
}
