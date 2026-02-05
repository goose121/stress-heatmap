package ca.mabdu.fukidney.myapplication

import android.Manifest
import android.content.Context
import android.location.Location
import androidx.annotation.RequiresPermission
import androidx.compose.runtime.MutableState
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.gms.tasks.CancellationTokenSource
import kotlinx.coroutines.CoroutineScope

import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType // added
import okhttp3.OkHttpClient // added
import okhttp3.Request // added
import okhttp3.RequestBody.Companion.toRequestBody //added



// NetworkHandler.kt - SIMPLE SAFE VERSION


import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.net.URL

object NetworkHandler {
    private const val BASE_URL = "http://10.0.2.2:8000"

    suspend fun sendTextToFastAPI(text: String): String {
        return withContext(Dispatchers.IO) {
            try {
                // Clean the text - remove any problematic characters
                val cleanText = text
                    .replace("\"", "'")      // Replace quotes with apostrophes
                    .replace("\n", " ")      // Replace newlines with spaces
                    .replace("\\", "")       // Remove backslashes
                    .trim()                  // Remove extra spaces

                // If text is empty after cleaning, use default
                val finalText = if (cleanText.isEmpty()) "No text provided" else cleanText

                val json = """{"text": "$finalText"}"""
                println("Sending: $json")

                val url = URL("$BASE_URL/predict")
                val connection = url.openConnection() as java.net.HttpURLConnection

                connection.requestMethod = "POST"
                connection.setRequestProperty("Content-Type", "application/json")
                connection.doOutput = true

                connection.outputStream.use { os ->
                    os.write(json.toByteArray())
                }

                val response = connection.inputStream.bufferedReader().use { it.readText() }
                connection.disconnect()

                response

            } catch (e: Exception) {
                "Error: ${e.message}"
            }
        }
    }
}

/*object NetworkHandler {
    @RequiresPermission(
        Manifest.permission.ACCESS_FINE_LOCATION
    )

    //ADDED
    private const val BASE_URL = "http://10.0.2.2:8000/"
    private val client = OkHttpClient()
    private val JSON = "application/json; charset=utf-8".toMediaType()
    //ADDED

    suspend fun predict(text: String): String {
        return try {
            // Create JSON exactly like your FastAPI expects: {"text": "user input"}
            val jsonBody = """{"text": "${text.replace("\"", "\\\"")}"}"""
                .toRequestBody(JSON)

            val request = Request.Builder()
                .url("$BASE_URL/predict")
                .post(jsonBody)
                .addHeader("Content-Type", "application/json")
                .build()

            val response = withContext(Dispatchers.IO) {
                client.newCall(request).execute()
            }

            response.body?.string() ?: "No response"

        } catch (e: Exception) {
            "Error: ${e.message}"
        }
    }
    suspend fun testServerReachable(): String {
        return withContext(Dispatchers.IO) {
            try {
                val url = ("http://10.0.2.2:8000/")
                val connection = url.openConnection() as HttpURLConnection
                connection.requestMethod = "GET"
                connection.connectTimeout = 5000  // 5 seconds

                val responseCode = connection.responseCode
                val response = connection.inputStream.bufferedReader().use { it.readText() }
                connection.disconnect()

                "✅ Server reachable! Code: $responseCode\nResponse: ${response.take(100)}..."
            } catch (e: Exception) {
                "❌ Cannot reach server: ${e.message}"
            }
        }
    }
}


/*
    suspend fun sendClassification(cl: Int, location: Location, ctx: Context) {


        delay(200)

        val locationInfo = "Current location is \n" + "lat : ${location.latitude}\n" +
                "long : ${location.longitude}\n" + "fetched at ${System.currentTimeMillis()}"


        println(locationInfo)


    }
}
*/
        */

// NetworkHandler.kt - SUPER SIMPLE VERSION

