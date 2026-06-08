import type { NavigatorScreenParams } from "@react-navigation/native";
import type { QuoteResponse, SettleResponse } from "./api";

export type PayFlowParamList = {
  PayEnter: undefined;
  PayReview: { vpa: string; amountInr: number };
  PaySuccess: { vpa: string; amountInr: number; quote: QuoteResponse; tx: SettleResponse };
};

export type RootTabsParamList = {
  Home: undefined;
  PayFlow: NavigatorScreenParams<PayFlowParamList>;
  History: undefined;
  Settings: undefined;
};
