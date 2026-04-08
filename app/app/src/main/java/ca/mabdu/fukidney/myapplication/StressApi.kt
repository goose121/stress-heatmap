package ca.mabdu.fukidney.myapplication

import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.POST

// 1. Definte the Interface (The "Contract")
interface StressApi {
    // This MUST match the path in your Cloudflare index.js
    @POST("api/stress-data")
    suspend fun uploadReport(@Body report: StressReport): Response<Unit>
}

// 2. Define the Data Class (The "Shape" of the JSON)
// These names MUST match the keys in your Cloudflare D1 database exactly
data class StressReport(
    val ip_address: String,   // The unique ID (UUID)
    val stress_level: Int,    // 1-5 from your ONNX model
    val department: String,
    val longitude: Double,    // From GPS
    val latitude: Double      // From GPS
)