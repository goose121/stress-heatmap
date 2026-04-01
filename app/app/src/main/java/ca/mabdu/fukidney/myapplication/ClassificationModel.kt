package ca.mabdu.fukidney.myapplication

import android.content.Context
import android.util.Log
import ai.onnxruntime.OnnxTensor
import ai.onnxruntime.OrtEnvironment
import ai.onnxruntime.OrtSession
import java.util.Collections

object ClassificationModel {
    private var ortEnv: OrtEnvironment = OrtEnvironment.getEnvironment()
    private var ortSession: OrtSession? = null

    // 1. You must call this ONCE in MainActivity's onCreate
    fun init(context: Context) {
        if (ortSession == null) {
            try {
                // Ensure your file is in app/src/main/assets/model.onnx
                val modelBytes = context.assets.open("model.onnx").readBytes()
                ortSession = ortEnv.createSession(modelBytes)
                Log.d("ONNX", "Model loaded successfully")
            } catch (e: Exception) {
                Log.e("ONNX", "Failed to load model", e)
            }
        }
    }

    // 2. This is the function your MainActivity currently calls
    fun classify(text: String): Int? {
        val session = ortSession ?: return null // Return default if not initialized

        return try {
            // Your Netron graph showed 'string_input'
            val inputName = session.inputNames.iterator().next()
            val tensor = OnnxTensor.createTensor(ortEnv, arrayOf(arrayOf(text)))

            // Run inference
            val output = session.run(Collections.singletonMap(inputName, tensor))

            // Get the 'label' output from the graph
            val labelValue = (output.get("label").get().value as? LongArray)!!
            val result = labelValue[0].toInt()

            Log.d("ONNX", "Predicted Stress Level: $result")
            result
        } catch (e: Exception) {
            Log.e("ONNX", "Inference failed, returning null", e)
            null
        }
    }
}