package ca.mabdu.fukidney.myapplication

import android.Manifest
import android.content.Context
import android.location.Location
import android.util.Log
import androidx.annotation.RequiresPermission
import kotlinx.coroutines.delay

object NetworkHandler {
    @RequiresPermission(
        Manifest.permission.ACCESS_FINE_LOCATION
    )
    suspend fun sendClassification(cl: Float, location: Location, department: String, ctx: Context) {

        // 1. Prepare the Data Object
        // We use a random UUID for ip_address so every submission is a new point
        val report = StressReport(
            ip_address = java.util.UUID.randomUUID().toString(),
            stress_level = cl,
            department = department,
            longitude = location.longitude,
            latitude = location.latitude
        )

        try {
            // 2. Actually call the Cloudflare API
            val response = RetrofitClient.api.uploadReport(report)

            if (response.isSuccessful) {
                Log.d("NetworkHandler", "Successfully sent to Cloudflare!")
            } else {
                Log.e("NetworkHandler", "Cloudflare rejected: ${response.code()}")
                throw Exception("Failed to sync with cloud")
            }
        } catch (e: Exception) {
            Log.e("NetworkHandler", "Network Connection Error", e)
            throw e // This will trigger the "Network Error" Toast in MainActivity
        }

        // Keep your debug print if you like
        val debugInfo = "Sent level $cl at lat: ${location.latitude} long: ${location.longitude}"
        println(debugInfo)
    }
}