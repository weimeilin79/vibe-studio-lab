"""`python -m agent.answer --pick 1` - answer the direction form: ONE
function_response, and the graph moves again (straight through the policy
gate)."""
import argparse

from . import lap


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--pick", default="1", help="1..3")
    a = ap.parse_args(argv)
    w = lap.where()
    if w["phase"] != "form":
        print(f"nothing to answer — phase is {w['phase']}"); return False
    cid, name = w["call"]
    lap.leg((cid, name, {"result": {"pick": a.pick}}))
    lap.print_where()
    return True


if __name__ == "__main__":
    main()
