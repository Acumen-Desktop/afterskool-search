"""Where the content is: the data and Mark's pictures, which this repo doesn't carry (they're his work, not ours to
publish under a code licence). It's a separate, private folder: the After Skool data repo, laid out as
    <content>/data/site/      graphData.json, artworkAssetsData.json, transcriptsIndex.json
    <content>/public/         stills/, assets/, thumbs/, share.jpg
Found from --content, else $AFTERSKOOL_CONTENT, else ../after-skool beside this repo."""
import argparse, os, pathlib

site = pathlib.Path(__file__).resolve().parent.parent


def args(*extra):
    ask = argparse.ArgumentParser()
    ask.add_argument('--content', default=os.environ.get('AFTERSKOOL_CONTENT', str(site.parent / 'after-skool')))
    for name, opts in extra:
        ask.add_argument(name, **opts)
    a = ask.parse_args()
    a.content = pathlib.Path(a.content).expanduser().resolve()
    if not (a.content / 'data/site/graphData.json').exists():
        ask.error(f'no After Skool content at {a.content} (want data/site/graphData.json there)')
    return a
