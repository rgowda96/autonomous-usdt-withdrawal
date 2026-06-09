import type { NavigatorScreenParams } from "@react-navigation/native";
import type { QuoteResponse, SettleResponse } from "./api";

export type PayFlowParamList = {
  PayEnter: undefined;
  PayReview: { vpa: string; amountInr: number };
  PaySuccess: { vpa: string; amountInr: number; quote: QuoteResponse; tx: SettleResponse };
};

export type HistoryStackParamList = {
  HistoryList: undefined;
  TxDetail: { txId: string };
};

export type RootTabsParamList = {
  Home: undefined;
  PayFlow: NavigatorScreenParams<PayFlowParamList>;
  History: NavigatorScreenParams<HistoryStackParamList>;
  Settings: undefined;
};
