package ca.mabdu.fukidney.myapplication

import ai.djl.huggingface.tokenizers.HuggingFaceTokenizer
import ai.onnxruntime.OnnxTensor
import ai.onnxruntime.OrtEnvironment
import ai.onnxruntime.OrtSession
import android.content.Context
import android.os.Build
import android.util.Log
import androidx.annotation.RequiresApi
import java.nio.file.Paths
import java.util.Collections
import java.util.stream.IntStream.range
import kotlin.io.path.Path
import kotlin.math.exp


object ClassificationModel {
    private var ortEnv: OrtEnvironment = OrtEnvironment.getEnvironment()
    private var ortSession: OrtSession? = null
    private var tokenizer: HuggingFaceTokenizer? = null

    // 1. You must call this ONCE in MainActivity's onCreate
    @RequiresApi(Build.VERSION_CODES.O)
    fun init(context: Context) {
        if (ortSession == null) {
            try {
                val tokenizerStream = copyAssetToFile(context, "tokenizer.json")

                val tokenizerConfig = copyAssetToFile(context, "model.onnx")

                tokenizer = HuggingFaceTokenizer.builder()
                    .optTokenizerPath(Path(tokenizerStream.absolutePath))
                    .build()
                val modelFile = copyAssetToFile(context, "model.onnx")
                copyAssetToFile(context, "Model_v5.onnx.data") // must be in same dir

//                // Ensure your file is in app/src/main/assets/model.onnx
//                val modelBytes = context.assets.open("model.onnx").readBytes()
                ortSession = ortEnv.createSession(modelFile.absolutePath)
                Log.d("ONNX", "Model loaded successfully")
            } catch (e: Exception) {
                Log.e("ONNX", "Failed to load model", e)
            }
        }
    }


    private fun copyAssetToFile(context: Context, assetName: String): java.io.File {
        val outFile = java.io.File(context.filesDir, assetName)
        if (!outFile.exists()) {
            context.assets.open(assetName).use { input ->
                outFile.outputStream().use { output ->
                    input.copyTo(output)
                }
            }
        }
        return outFile
    }


    // 2. This is the function your MainActivity currently calls
    fun classify(text: String): Float? {
        val session = ortSession ?: return null // Return default if not initialized

        return try {
            val nameIter = session.inputNames.iterator()
            // Your Netron graph showed 'string_input'
            val idsName = nameIter.next()
            val atnMaskName = nameIter.next()


            val tokens = tokenizer!!.encode(text)

            val idsTensor = OnnxTensor.createTensor(ortEnv, arrayOf(tokens.ids))
            val atnMaskTensor = OnnxTensor.createTensor(ortEnv, arrayOf(tokens.attentionMask))

            // Run inference
            val output = session.run(mapOf(
                Pair(idsName, idsTensor),
                Pair(atnMaskName, atnMaskTensor)
            ))

            // Get the 'label' output from the graph
            val logitsValue = (output.get("logits").get().value as? Array<*>)!!
            val result = (logitsValue[0] as? FloatArray)!!

            var softMax = result.map({exp(it)}).toMutableList()
            val divisor = softMax.sum()

            for (i in range(0, softMax.size)) {
                softMax[i] = softMax[i] / divisor
            }

            var score = 0.0f;
            for (level in range(1,6)) {
                score += level * softMax[level-1]
            }

            Log.d("ONNX", "Predicted Stress Level: $score")
            score
        } catch (e: Exception) {
            Log.e("ONNX", "Inference failed, returning null", e)
            null
        }
    }
}