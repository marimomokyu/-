
// xxx部分をChannel Access Token => ISSUE で発行された文字列に置き換える
//2020.01.08 mod Start 取得方法変更(スクリプトのプロパティから取得するようにした)
//var channel_access_token = AccessToken()

var channel_access_token = PropertiesService.getScriptProperties().getProperty("CHANNEL_ACCESS_TOKEN");
var spredsheetIdDB = PropertiesService.getScriptProperties().getProperty("SPREDSHEET_ID");
//2020.01.08 mod End
function doPost(e) {
  
  var posted_json = JSON.parse(e.postData.contents);
  var events = posted_json.events;
  
   //送られたLINEメッセージを取得
  var json = JSON.parse(e.postData.contents);
  var user_message = json.events[0].message.text;  
  
  //送られて来た種類
  //テキスト:いい感じ返信
  //画像:文字起こし
  //スタンプ:無視
  var receive_message_type = json.events[0].message.type;
      

  events.forEach(function(event) {
   if(event.type == "message"){
     
     if (event.message.type == 'image'){
       //文字起こし
       //OCR機能を使って送られてきた画像のテキストを返す
       
       ImageUrl = getImageUrlByLine(event.message.id)
       imageBlob = getImageBlobByImageUrl(ImageUrl);
       
       message = GetOcrTextByimageBlob(imageBlob)
       message = GetTransByText(message)
       
       var url = getImageBlobByImageUrl(ImageUrl);
       
       //lineReplyFirst(event,message);
       lineReply(event,message);
       
       //ログ出力
       var user = JSON.parse(e.postData.contents).events[0].source.userId;
       var userName = getUsername(user);
       var logText = user_message
       addLog(userName　);
       addLog('【応答' + url + '】' + message);
     }
     
     
    if (event.message.type == 'text'){
      //スプレットシードの会話一覧から一番適切な文章を返す
      
     //Start*****************配列をスプレットシードから取得*****************************
      //2020.01.08 del Start 取得方法変更(スクリプトのプロパティから取得するようにした)
      //var spredsheetIdDB = SpredSheetIdDb()
      //2020.01.08 del End
      var spreadsheet = SpreadsheetApp.openById(spredsheetIdDB);
      var sheet = spreadsheet.getActiveSheet();
  
      //シートに記載されている最終行を取得
      var ALastRow = sheet.getLastRow();
      
      //ユーザー発言を取得
      var ArrayMessage = sheet.getRange(1,1,ALastRow).getValues();
      Logger.log(ArrayMessage);
      
      //まりも発言を取得
      var ArrayResponse = sheet.getRange(1,2,ALastRow).getValues();
      Logger.log(ArrayResponse);
      //End*****************配列をスプレットシードから取得***************************** 
      

      
      
      
      
      //レーベンシュタイン距離 
      //ユーザーが入力したテキストと、ArrayMessageのレーベンシュタイン距離を比較。最も小さいものの返答を出力
      var s1_len = user_message.length;　//ユーザーの発言
      var s2_len = ArrayMessage[0][0].length; //こっちの発言　
      
      if (s1_len <= s2_len){
        var minlevenshtein  = levenshtein(user_message, ArrayMessage[0][0]) / s2_len;
      }else if(s1_len> s2_len){
        var minlevenshtein  = levenshtein(user_message, ArrayMessage[0][0]) / s1_len;
      }
      
      
      //初期化
      var min_i = 0;
      
      for(var i=1;i<ArrayMessage.length;i++){
        
        var s2_len = ArrayMessage[i][0].length; //こっちの発言
        if (s1_len <= s2_len){
          var nowlevenshtein = levenshtein(user_message, ArrayMessage[i][0]) /s2_len;
        }else if(s1_len> s2_len){
          var nowlevenshtein = levenshtein(user_message, ArrayMessage[i][0]) /s1_len;
        }
        
        if (nowlevenshtein <= minlevenshtein){
          if (s1_len <= s2_len){
            minlevenshtein = levenshtein(user_message, ArrayMessage[i][0]) / s2_len; //最小のレーベンシュタイン距離更新
          }else if(s1_len> s2_len){
            minlevenshtein = levenshtein(user_message, ArrayMessage[i][0]) / s1_len; //最小のレーベンシュタイン距離更新
          }
          min_i = i;
        }
        
        if (minlevenshtein == 0){
          break;
        }
      }
      
      //ログ出力
      var user = JSON.parse(e.postData.contents).events[0].source.userId;
      var userName = getUsername(user);
      var logText = user_message
      addLog('【' + userName　+ ':' + minlevenshtein + '】' + logText);
      addLog('【応答】' + ArrayResponse[min_i][0]);
      
      
      var postData = {
        "replyToken" :event.replyToken,
        "messages" : [
          {
            "type" : "text",
            "text" :  ArrayResponse[min_i][0]
          }
        ]
      };
      
      
      
      var options = {
        "method" : "post",
        "headers" : {
          "Content-Type" : "application/json",
          "Authorization" : "Bearer " + channel_access_token
        },
        "payload" : JSON.stringify(postData)
      };
      var reply = UrlFetchApp.fetch("https://api.line.me/v2/bot/message/reply", options);
      
    } 
   }    
  });
};








//レーベンシュタイン距離
function levenshtein (s1, s2) {
  // http://kevin.vanzonneveld.net
  // +            original by: Carlos R. L. Rodrigues (http://www.jsfromhell.com)
  // +            bugfixed by: Onno Marsman
  // +             revised by: Andrea Giammarchi (http://webreflection.blogspot.com)
  // + reimplemented by: Brett Zamir (http://brett-zamir.me)
  // + reimplemented by: Alexander M Beedie
  // *                example 1: levenshtein('Kevin van Zonneveld', 'Kevin van Sommeveld');
  // *                returns 1: 3
  
  if (s1 == s2) {
    return 0;
  }
  
  var s1_len = s1.length;
  var s2_len = s2.length;
  if (s1_len === 0) {
    return s2_len;
  }
  if (s2_len === 0) {
    return s1_len;
  }
  
  // BEGIN STATIC
  var split = false;
  try{
    split=!('0')[0];
  } catch (e){
    split=true; // Earlier IE may not support access by string index
  }
  // END STATIC
  if (split){
    s1 = s1.split('');
    s2 = s2.split('');
  }
  
  var v0 = new Array(s1_len+1);
  var v1 = new Array(s1_len+1);
  
  var s1_idx=0, s2_idx=0, cost=0;
  for (s1_idx=0; s1_idx<s1_len+1; s1_idx++) {
    v0[s1_idx] = s1_idx;
  }
  var char_s1='', char_s2='';
  for (s2_idx=1; s2_idx<=s2_len; s2_idx++) {
    v1[0] = s2_idx;
    char_s2 = s2[s2_idx - 1];
    
    for (s1_idx=0; s1_idx<s1_len;s1_idx++) {
      char_s1 = s1[s1_idx];
      cost = (char_s1 == char_s2) ? 0 : 1;
      var m_min = v0[s1_idx+1] + 1;
      var b = v1[s1_idx] + 1;
      var c = v0[s1_idx] + cost;
      if (b < m_min) {
        m_min = b; }
      if (c < m_min) {
        m_min = c; }
      v1[s1_idx+1] = m_min;
    }
    var v_tmp = v0;
    v0 = v1;
    v1 = v_tmp;
  }
  return v0[s1_len];
}




function addLog(text/*ログ内容*/) {
  //2020.01.08 mod Start 取得方法変更(スクリプトのプロパティから取得するようにした)
  //var spreadsheetIdLog = SpredSheetIdLog();
  var spreadsheetIdLog = PropertiesService.getScriptProperties().getProperty("SPREDSHEET_ID_LOG");
  //2020.01.08 mod End
  var sheetName = "Sheet1";
  var spreadsheet = SpreadsheetApp.openById(spreadsheetIdLog);
  var sheet = spreadsheet.getSheetByName(sheetName);
  sheet.appendRow([new Date()/*タイムスタンプ*/,text]);
  return text;
}

//ユーザー名
function getUsername(userId) {
  var url = 'https://api.line.me/v2/bot/profile/' + userId;
  var response = UrlFetchApp.fetch(url, {
    'headers': {
      'Authorization': 'Bearer ' + channel_access_token
    }
  });
  return JSON.parse(response.getContentText()).displayName;
}




//イメージ画像のURLを取得する
function getImageUrlByLine(message_id) {
  var url = 'https://api.line.me/v2/bot/message/' + message_id + '/content';
  return url;
}

//URLから画像を取り出す
function getImageBlobByImageUrl(url){
  
  var res = UrlFetchApp.fetch(url, {
    'headers': {
      'Content-Type': 'application/json; charset=UTF-8',
      'Authorization': 'Bearer ' + channel_access_token,
    },
    'method': 'get'
  });
  
  var imageBlob = res.getBlob().getAs("image/png").setName("temp.png")
  return imageBlob;
}

//画像をOCRで文字起こしを行う
function GetOcrTextByimageBlob(imageBlob) {
  var resource = {
    title: imageBlob.getName(),
    mimeType: imageBlob.getContentType()
  };
  var options = {
    ocr: true,
  };
  
  var file = Drive.Files.insert(resource, imageBlob, options);
  
  var doc = DocumentApp.openById(file.id);
  var text = doc.getBody().getText();
  
  return text
}

//メッセージを追加する
function GetTransByText(text) {
  //message += "読み上げるクマ"
  message += "\n"
  return message;
}

//Lineのメッセージを返却する
function lineReply(event,message) {
  
  var postData = {
    "replyToken" : event.replyToken,
    "messages" : [
      {
        "type" : "text",
        "text" : '文字起こし完了ლ(´ڡ`ლ)✨'
      },
      {
        "type" : "text",
        "text" : '' + message
      }
    ]
  };
  
  
  
  
  var options = {
    "method" : "post",
    "headers" : {
      "Content-Type" : "application/json",
      "Authorization" : "Bearer " + channel_access_token
    },
    "payload" : JSON.stringify(postData)
  };
  
  UrlFetchApp.fetch("https://api.line.me/v2/bot/message/reply", options);
}


//待ち時間メッセージ
function lineReply_Wait(event) {
  
  var postData = {
    "replyToken" : event.replyToken,
    "messages" : [
      {
        "type" : "text",
        "text" : '文字起こし中・・・'
      }
    ]
  };
  
  var options = {
    "method" : "post",
    "headers" : {
      "Content-Type" : "application/json",
      "Authorization" : "Bearer " + channel_access_token
    },
    "payload" : JSON.stringify(postData)
  };
  
  UrlFetchApp.fetch("https://api.line.me/v2/bot/message/reply", options);
}