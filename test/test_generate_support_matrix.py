import importlib.util
import pathlib
import unittest


MODULE_PATH = (
    pathlib.Path(__file__).resolve().parent.parent
    / "tools"
    / "generate-support-matrix.py"
)
SPEC = importlib.util.spec_from_file_location(
    "generate_support_matrix",
    MODULE_PATH,
)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(MODULE)


class GenerateSupportMatrixTest(unittest.TestCase):
    def test_parse_args_defaults_to_legacy_cli(self):
        args = MODULE.parse_args([])

        self.assertEqual(args.cli, "legacy")
        self.assertFalse(args.details)
        self.assertFalse(args.update_page)

    def test_parse_args_accepts_ts_cli(self):
        args = MODULE.parse_args(["--cli", "ts", "--details", "--format", "text"])

        self.assertEqual(args.cli, "ts")
        self.assertTrue(args.details)
        self.assertEqual(args.format, "text")

    def test_build_probe_command_for_legacy_cli(self):
        command = MODULE.build_probe_command("legacy", "GOOG", "price")

        self.assertEqual(
            command,
            ["node", str(MODULE.LEGACY_CLI_PATH), "GOOG", "price"],
        )

    def test_build_probe_command_for_ts_cli(self):
        command = MODULE.build_probe_command("ts", "GOOG", "price")

        self.assertEqual(
            command,
            ["node", str(MODULE.TS_CLI_PATH), "GOOG", "price"],
        )

    def test_format_text_table_renders_plain_grid(self):
        output = MODULE.format_text_table(
            ["Exchange", "Basic quote"],
            [["NASDAQ", "✅"], ["TLV", "⚠️"]],
        )

        self.assertIn("Exchange", output)
        self.assertIn("NASDAQ", output)
        self.assertIn("TLV", output)
        self.assertIn("✅", output)
        self.assertIn("⚠️", output)


if __name__ == "__main__":
    unittest.main()
