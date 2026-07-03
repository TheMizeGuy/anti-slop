# TODO: implement validation
def process_data(rows):
    # first, we loop through the rows
    total = 0
    for row in rows:
        try:
            total += row["amount"]
        except:
            pass
    return total
