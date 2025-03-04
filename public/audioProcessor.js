class AudioProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0]
    if (input.length > 0) {
      const inputData = input[0]
      const pcmData = new Int16Array(inputData.length)
      
      // Convert Float32 to Int16
      for (let i = 0; i < inputData.length; i++) {
        const s = Math.max(-1, Math.min(1, inputData[i]))
        pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
      }

      this.port.postMessage({
        type: 'audio',
        pcmData
      })
    }
    return true
  }
}

registerProcessor('audio-processor', AudioProcessor) 