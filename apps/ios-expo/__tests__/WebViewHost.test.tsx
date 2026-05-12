import { render } from "@testing-library/react-native";

import { WebViewHost } from "@/WebViewHost";

jest.mock("react-native-webview", () => {
  const React = require("react");
  return {
    WebView: React.forwardRef((props: any, ref: any) => {
      React.useImperativeHandle(ref, () => ({
        injectJavaScript: jest.fn(),
        reload: jest.fn(),
      }));
      return React.createElement("WebView", { ...props, ref });
    }),
  };
});

describe("WebViewHost", () => {
  it("renders the WebView with default URL", () => {
    const { getByTestId } = render(<WebViewHost />);
    const view = getByTestId("rr-webview");
    expect(view.props.source.uri).toBe("https://rateradar-web.vercel.app");
  });

  it("accepts an override source URL", () => {
    const { getByTestId } = render(<WebViewHost source="https://preview.example.com" />);
    const view = getByTestId("rr-webview");
    expect(view.props.source.uri).toBe("https://preview.example.com");
  });
});
