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
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

object NetworkHandler {
    @RequiresPermission(
        Manifest.permission.ACCESS_FINE_LOCATION
    )

    suspend fun sendClassification(cl: Int, location: Location, ctx: Context) {


        delay(200)

        val locationInfo = "Current location is \n" + "lat : ${location.latitude}\n" +
                "long : ${location.longitude}\n" + "fetched at ${System.currentTimeMillis()}"


        println(locationInfo)
    }
}
