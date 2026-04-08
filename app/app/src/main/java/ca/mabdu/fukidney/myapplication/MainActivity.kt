package ca.mabdu.fukidney.myapplication

import android.Manifest
import android.content.Context
import android.os.Bundle
import android.util.Log
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.input.TextFieldLineLimits
import androidx.compose.foundation.text.input.rememberTextFieldState
import androidx.compose.foundation.text.input.setTextAndPlaceCursorAtEnd
import androidx.compose.material3.Button
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuAnchorType
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextField
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import ca.mabdu.fukidney.myapplication.ui.theme.MyApplicationTheme
//import ca.mabdu.fukidney.myapplication.ui.theme.MyApplicationTheme
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.gms.tasks.CancellationTokenSource
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.tasks.await

class MainActivity : ComponentActivity() {
    // Semaphore to block until GPS permission is acquired
    private val permSemaphore = Semaphore(1, 1)
    private enum class NetworkState {
        IDLE, BUSY
    }
    private val networkState = mutableStateOf(NetworkState.IDLE)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // 1. Initialize the AI Model (Critical!)
        ClassificationModel.init(this)

        // 2. Setup the UI
        enableEdgeToEdge()
        setContent {
            MyApplicationTheme {
                MainContent()
            }
        }
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String?>,
        grantResults: IntArray,
        deviceId: Int
    ) {
        permSemaphore.release()
    }

    @OptIn(ExperimentalMaterial3Api::class)
    @Composable
    fun MainContent() {
//        MyApplicationTheme() {
            Scaffold(
                modifier = Modifier.fillMaxSize(),
            ) { innerPadding ->
                Column(
                    modifier = Modifier
                        .padding(innerPadding)
                        .padding(10.dp, 0.dp),
                ) {
                    var feelingsFieldState = rememberTextFieldState()
                    OutlinedTextField(
                        state = feelingsFieldState,
                        label = { Text("How are you feeling?") },
                        lineLimits = TextFieldLineLimits.MultiLine(),
                        modifier = Modifier
                            .weight(1.0f)
                            .fillMaxWidth()

                    )

                    // Dropdown code taken from
                    // https://developer.android.com/reference/kotlin/androidx/compose/material3/ExposedDropdownMenuBox.composable
                    var expanded by remember { mutableStateOf(false) }
                    val departmentFieldState = rememberTextFieldState(departments[0])

                    ExposedDropdownMenuBox(expanded = expanded, onExpandedChange = { expanded = it }) {
                        TextField(
                            // The `menuAnchor` modifier must be passed to the text field to handle
                            // expanding/collapsing the menu on click. A read-only text field has
                            // the anchor type `PrimaryNotEditable`.
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(0.dp, 20.dp, 0.dp, 0.dp)
                                .menuAnchor(ExposedDropdownMenuAnchorType.PrimaryNotEditable),
                            state = departmentFieldState,
                            readOnly = true,
                            lineLimits = TextFieldLineLimits.SingleLine,
                            label = { Text("Department") },
                            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
                            colors = ExposedDropdownMenuDefaults.textFieldColors(),
                        )
                        ExposedDropdownMenu(
                            expanded = expanded,
                            onDismissRequest = { expanded = false },
                        ) {
                            departments.forEachIndexed { _, option ->
                                DropdownMenuItem(
                                    text = { Text(option, style = MaterialTheme.typography.bodyLarge) },
                                    onClick = {
                                        departmentFieldState.setTextAndPlaceCursorAtEnd(option)
                                        expanded = false
                                    },
                                    contentPadding = ExposedDropdownMenuDefaults.ItemContentPadding,
                                )
                            }
                        }
                    }

                    val ctx = LocalContext.current
                    val scope = rememberCoroutineScope()
                    val networkState by networkState
                    Button(
                        modifier = Modifier
                            .padding(0.dp, 10.dp)
                            .fillMaxWidth(),
                        onClick = {
                            sendNetworkData(feelingsFieldState.text.toString(), ctx, scope)
                        },
                        enabled = networkState == NetworkState.IDLE
                    ) {
                        Text(
                            when(networkState) {
                                NetworkState.IDLE -> "Submit with location"
                                NetworkState.BUSY -> "Sending..."
                            }
                        )
                    }
                }
//            }
        }
    }

    private fun sendNetworkData(
        data: String,
        ctx: Context,
        scope: CoroutineScope
    ) {
        networkState.value = NetworkState.BUSY
        requestPermissions(
            arrayOf(
                Manifest.permission.ACCESS_FINE_LOCATION),
            0
        )

        scope.launch(Dispatchers.IO) {
            permSemaphore.acquire()

            // Location code adapted from https://github.com/android/platform-samples/blob/main/samples/location/src/main/java/com/example/platform/location/currentLocation/CurrentLocationScreen.kt
            val locationClient = LocationServices.getFusedLocationProviderClient(ctx)
            var locationInfo = ""

            // High accuracy is important for data quality
            val priority = Priority.PRIORITY_HIGH_ACCURACY

            try {
                val location = locationClient.getCurrentLocation(
                    priority,
                    CancellationTokenSource().token,
                ).await()

                if (location == null) {
                    runOnUiThread {
                        Toast.makeText(
                            this@MainActivity,
                            "Location fetch failed",
                            Toast.LENGTH_SHORT
                        )
                            .show()
                        Log.e("MainActivity", "Error fetching location")
                    }
                    return@launch
                }

                try {
                    NetworkHandler.sendClassification(
                        cl = ClassificationModel.classify(
                            data
                        )!!,
                        location,
                        ctx = ctx,
                    )
                } catch (e: Exception) {
                    runOnUiThread {
                        Toast.makeText(
                            this@MainActivity,
                            "Network error",
                            Toast.LENGTH_SHORT
                        )
                            .show()
                        Log.e("MainActivity", "Error sending network data: ", e)
                    }
                } finally {
                    networkState.value = NetworkState.IDLE
                }
            } catch (e: SecurityException) {
                runOnUiThread {
                    Toast.makeText(
                        this@MainActivity,
                        "Location permission is required to submit",
                        Toast.LENGTH_SHORT
                    ).show()
                }
            }
        }
    }

    @Preview(showBackground = true)
    @Composable
    fun MainContentPreview() {
//        MyApplicationTheme {
            MainContent()
//        }
    }
}

