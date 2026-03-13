import argparse
import json
import wave


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", required=True)
    ap.add_argument("--wav", required=True)
    args = ap.parse_args()

    try:
        from vosk import Model, KaldiRecognizer, SetLogLevel
    except Exception as e:
        raise SystemExit(
            "未安装 Python vosk 依赖。请执行：pip install vosk\n" + str(e)
        )

    SetLogLevel(-1)
    wf = wave.open(args.wav, "rb")
    if wf.getnchannels() != 1 or wf.getframerate() != 16000:
        # 我们后端在进入 Vosk 前已经用 ffmpeg 转过 16k/mono，这里仅做保护
        raise SystemExit("输入 wav 必须是 16kHz 单声道 PCM")

    model = Model(args.model)
    rec = KaldiRecognizer(model, wf.getframerate())

    text_parts = []
    while True:
        data = wf.readframes(4000)
        if len(data) == 0:
            break
        if rec.AcceptWaveform(data):
            r = json.loads(rec.Result())
            t = (r.get("text") or "").strip()
            if t:
                text_parts.append(t)

    r = json.loads(rec.FinalResult())
    t = (r.get("text") or "").strip()
    if t:
        text_parts.append(t)

    out = {"text": " ".join(text_parts).strip()}
    print(json.dumps(out, ensure_ascii=False))


if __name__ == "__main__":
    main()

