The file is missing a closing `FDownloadLink` tag and a closing `}` for the component. Here's the fixed ending:

```jsx
                      </PDFDownloadLink>
                    ) : (
                      <div className="p-2 bg-yellow-50 text-yellow-600 rounded-md text-sm">
                        <div className="flex items-center">
                          <AlertTriangle className="h-4 w-4 mr-1" />
                          <span>
                            Complete los datos del cliente y asegúrese que la forma de pago coincida con el precio total.
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default BrokerQuotePage;
```