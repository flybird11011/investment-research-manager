#!/usr/bin/env python3

import argparse
import asyncio

import edge_tts


async def main() -> None:
    parser = argparse.ArgumentParser(description="Generate speech with edge-tts")
    parser.add_argument("--text", required=True)
    parser.add_argument("--voice", required=True)
    parser.add_argument("--rate", default="+0%")
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    communicator = edge_tts.Communicate(
        text=args.text,
        voice=args.voice,
        rate=args.rate,
    )
    await communicator.save(args.output)


if __name__ == "__main__":
    asyncio.run(main())

