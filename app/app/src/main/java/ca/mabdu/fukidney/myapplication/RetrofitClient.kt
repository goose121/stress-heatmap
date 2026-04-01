package ca.mabdu.fukidney.myapplication

import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory

object RetrofitClient {
    // 1. Paste your Cloudflare URL here.
    // IMPORTANT: It MUST end with a forward slash /
    private const val BASE_URL = "https://stress-heatmap-worker.cthak393.workers.dev/"

    // 2. This creates the implementation of your StressApi interface
    val api: StressApi by lazy {
        Retrofit.Builder()
            .baseUrl(BASE_URL)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(StressApi::class.java)
    }
}