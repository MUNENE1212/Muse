import sys
import types


def _install_stub_module(name: str) -> None:
    if name in sys.modules:
        return
    module = types.ModuleType(name)
    sys.modules[name] = module


def pytest_configure(config):
    for name in ("langchain_openai", "langchain_core", "langchain_core.prompts"):
        _install_stub_module(name)

    chat_openai = sys.modules["langchain_openai"]

    class _ChatOpenAI:
        def __init__(self, *args, **kwargs):
            self._args = args
            self._kwargs = kwargs

        def with_structured_output(self, _schema):
            return self

        def invoke(self, _payload):
            raise RuntimeError("Stub ChatOpenAI.invoke should not be called in unit tests")

    chat_openai.ChatOpenAI = _ChatOpenAI

    prompts = sys.modules["langchain_core.prompts"]

    class _ChatPromptTemplate:
        @staticmethod
        def from_messages(_messages):
            return _ChatPromptTemplate()

        def __or__(self, other):
            return _Chain(other)

    class _Chain:
        def __init__(self, target):
            self._target = target

        def invoke(self, _payload):
            raise RuntimeError("Stub chain.invoke should not be called in unit tests")

    prompts.ChatPromptTemplate = _ChatPromptTemplate
